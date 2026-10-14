"""Offline stereo DSP engine with oversampled peak protection."""
import numpy as np
from pedalboard import HighShelfFilter, LowShelfFilter, Pedalboard, Reverb
from scipy.signal import lfilter, resample_poly


def _oversampled_true_peak(samples: np.ndarray, factor: int = 4) -> float:
    """Estimate inter-sample peak by 4x polyphase oversampling in bounded chunks."""
    if samples.size == 0:
        return 0.0
    peak = float(np.max(np.abs(samples)))
    chunk_size = 8192
    # A 32-frame pad keeps most FIR boundary transients out of the measured region.
    pad = 32
    for start in range(0, len(samples), chunk_size):
        end = min(start + chunk_size, len(samples))
        lo, hi = max(0, start - pad), min(len(samples), end + pad)
        block = samples[lo:hi]
        if len(block) < 2:
            continue
        oversampled = resample_poly(block, factor, 1, axis=0)
        local_start = (start - lo) * factor
        local_end = local_start + (end - start) * factor
        peak = max(peak, float(np.max(np.abs(oversampled[local_start:local_end]))))
    return peak


def process_audio(
    audio: np.ndarray,
    sample_rate: int,
    *,
    movement_depth: float = 0.32,
    movement_rate: float = 0.08,
    stereo_width: float = 1.08,
    reverb_mix: float = 0.06,
    output_ceiling_db: float = -1.0,
    movement_enabled: bool = True,
    width_enabled: bool = True,
    reverb_enabled: bool = True,
    bass_gain_db: float = 0.0,
    treble_gain_db: float = 0.0,
) -> np.ndarray:
    """Process mono/stereo samples shaped as frames x channels.

    Peak protection uses 4x oversampled inter-sample peak estimation and applies
    transparent static gain reduction. It is a true-peak ceiling guard, not a
    look-ahead or loudness-normalizing limiter.
    """
    if sample_rate < 8000:
        raise ValueError("Sample rate must be at least 8000 Hz.")
    if not 0 <= movement_depth <= 1:
        raise ValueError("movement_depth must be between 0 and 1.")
    if not 0.02 <= movement_rate <= 1:
        raise ValueError("movement_rate must be between 0.02 and 1 Hz.")
    if not 0 <= stereo_width <= 2:
        raise ValueError("stereo_width must be between 0 and 2.")
    if not 0 <= reverb_mix <= 0.5:
        raise ValueError("reverb_mix must be between 0 and 0.5.")
    if not -12 <= bass_gain_db <= 12 or not -12 <= treble_gain_db <= 12:
        raise ValueError("Bass and treble gain must be between -12 and 12 dB.")
    if not -12 <= output_ceiling_db <= -0.1:
        raise ValueError("output_ceiling_db must be between -12 and -0.1 dB.")
    if audio.ndim not in (1, 2):
        raise ValueError("Audio must be mono or stereo.")
    samples = np.asarray(audio, dtype=np.float32)
    if samples.ndim == 1:
        samples = np.column_stack((samples, samples))
    elif samples.shape[1] == 1:
        samples = np.repeat(samples, 2, axis=1)
    elif samples.shape[1] != 2:
        raise ValueError("Only mono and stereo input are supported.")
    samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    if len(samples) == 0:
        raise ValueError("Audio file is empty.")

    output = samples.copy()
    if width_enabled:
        left, right = output[:, 0], output[:, 1]
        mid = (left + right) * 0.5
        side = (left - right) * 0.5
        output = np.column_stack((mid + side * stereo_width, mid - side * stereo_width)).astype(np.float32, copy=False)

    if movement_enabled and movement_depth > 0:
        time = np.arange(len(output), dtype=np.float64) / sample_rate
        raw_pan = movement_depth * np.sin(2 * np.pi * movement_rate * time)
        # A short one-pole smoother prevents abrupt control transitions while
        # retaining the intentionally slow, continuous orbit motion.
        alpha = 1.0 - np.exp(-1.0 / (sample_rate * 0.012))
        pan = lfilter([alpha], [1.0, -(1.0 - alpha)], raw_pan).astype(np.float32)
        angle = (pan + 1.0) * (np.pi / 4.0)
        output[:, 0] *= np.cos(angle).astype(np.float32)
        output[:, 1] *= np.sin(angle).astype(np.float32)

    if bass_gain_db != 0 or treble_gain_db != 0:
        eq = []
        if bass_gain_db != 0:
            eq.append(LowShelfFilter(cutoff_frequency_hz=180, gain_db=bass_gain_db))
        if treble_gain_db != 0:
            eq.append(HighShelfFilter(cutoff_frequency_hz=4500, gain_db=treble_gain_db))
        output = Pedalboard(eq)(output.T, sample_rate=sample_rate).T.astype(np.float32)

    if reverb_enabled and reverb_mix > 0:
        effects = Pedalboard([Reverb(room_size=0.55, damping=0.5, wet_level=reverb_mix, dry_level=1.0, width=1.0)])
        output = effects(output.T, sample_rate=sample_rate).T.astype(np.float32)

    ceiling = 10.0 ** (output_ceiling_db / 20.0)
    true_peak = _oversampled_true_peak(output)
    if true_peak > ceiling:
        output *= np.float32(ceiling / true_peak)
    return np.ascontiguousarray(output, dtype=np.float32)
