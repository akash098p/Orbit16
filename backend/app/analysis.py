"""Objective stereo and loudness measurements for processed audio."""
from __future__ import annotations

import math
import numpy as np
import pyloudnorm as pyln

from app.audio_engine import _oversampled_true_peak


def analyze_audio(audio: np.ndarray, sample_rate: int) -> dict[str, float | None]:
    """Return integrated loudness, oversampled true peak, correlation and mono-fold metrics."""
    samples = np.asarray(audio, dtype=np.float64)
    if samples.ndim == 1:
        samples = np.column_stack((samples, samples))
    if samples.ndim != 2 or samples.shape[1] != 2:
        raise ValueError("Analysis expects mono or stereo audio.")
    if len(samples) == 0:
        raise ValueError("Audio file is empty.")
    samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    peak = _oversampled_true_peak(samples.astype(np.float32))
    true_peak_db = 20.0 * math.log10(peak) if peak > 0 else None

    left, right = samples[:, 0], samples[:, 1]
    left_energy = float(np.dot(left, left))
    right_energy = float(np.dot(right, right))
    denominator = math.sqrt(left_energy * right_energy)
    correlation = float(np.dot(left, right) / denominator) if denominator > 1e-20 else None
    if correlation is not None:
        correlation = max(-1.0, min(1.0, correlation))

    stereo_rms = math.sqrt((left_energy + right_energy) / (2.0 * len(samples)))
    mono = (left + right) * 0.5
    mono_rms = float(np.sqrt(np.mean(mono * mono)))
    mono_fold_db = 20.0 * math.log10(mono_rms / stereo_rms) if mono_rms > 0 and stereo_rms > 0 else None

    loudness = None
    try:
        value = float(pyln.Meter(sample_rate).integrated_loudness(samples))
        if math.isfinite(value):
            loudness = value
    except (ValueError, RuntimeError, ZeroDivisionError):
        # Very short or silent clips may not provide enough valid blocks for LUFS.
        loudness = None

    return {
        "integrated_lufs": round(loudness, 2) if loudness is not None else None,
        "true_peak_dbtp": round(true_peak_db, 2) if true_peak_db is not None else None,
        "stereo_correlation": round(correlation, 3) if correlation is not None else None,
        "mono_fold_down_db": round(mono_fold_db, 2) if mono_fold_db is not None else None,
    }
