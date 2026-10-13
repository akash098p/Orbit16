"""Offline stereo DSP engine. "16D" is an informal creative label, not a format."""
import numpy as np
from pedalboard import Pedalboard, Reverb

def process_audio(
    audio: np.ndarray,
    sample_rate: int,
    *,
    movement_depth: float = 0.65,
    movement_rate: float = 0.12,
    stereo_width: float = 1.20,
    reverb_mix: float = 0.12,
    output_ceiling_db: float = -1.0,
) -> np.ndarray:
    """Process mono/stereo samples shaped as frames x channels.

    The safety stage is sample-peak attenuation, not a true-peak limiter.
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

    left, right = samples[:, 0], samples[:, 1]
    mid = (left + right) * 0.5
    side = (left - right) * 0.5
    output = np.column_stack((mid + side * stereo_width, mid - side * stereo_width)).astype(np.float32, copy=False)

    if movement_depth > 0:
        time = np.arange(len(output), dtype=np.float64) / sample_rate
        pan = movement_depth * np.sin(2 * np.pi * movement_rate * time)
        angle = (pan + 1.0) * (np.pi / 4.0)
        output[:, 0] *= (np.sqrt(2.0) * np.cos(angle)).astype(np.float32)
        output[:, 1] *= (np.sqrt(2.0) * np.sin(angle)).astype(np.float32)

    if reverb_mix > 0:
        effects = Pedalboard([Reverb(room_size=0.55, damping=0.5, wet_level=reverb_mix, dry_level=1.0, width=1.0)])
        output = effects(output.T, sample_rate=sample_rate).T.astype(np.float32)

    ceiling = 10.0 ** (output_ceiling_db / 20.0)
    peak = float(np.max(np.abs(output))) if output.size else 0.0
    if peak > ceiling:
        output *= np.float32(ceiling / peak)
    return np.ascontiguousarray(output, dtype=np.float32)
