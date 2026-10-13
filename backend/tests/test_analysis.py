import numpy as np
from app.analysis import analyze_audio


def test_analysis_reports_stereo_metrics_for_tone():
    sr = 48000
    t = np.arange(sr, dtype=np.float32) / sr
    tone = 0.2 * np.sin(2 * np.pi * 440 * t)
    result = analyze_audio(np.column_stack((tone, tone)), sr)
    assert result["integrated_lufs"] is not None
    assert result["true_peak_dbtp"] is not None
    assert result["stereo_correlation"] == 1.0
    assert result["mono_fold_down_db"] is not None


def test_analysis_silence_handles_undefined_metrics():
    result = analyze_audio(np.zeros((1024, 2), dtype=np.float32), 48000)
    assert result["true_peak_dbtp"] is None
    assert result["stereo_correlation"] is None
    assert result["integrated_lufs"] is None


def test_true_peak_guard_stays_under_ceiling_for_high_frequency_signal():
    from app.audio_engine import process_audio, _oversampled_true_peak
    sr = 48000
    t = np.arange(sr, dtype=np.float32) / sr
    signal = np.column_stack((0.95 * np.sin(2 * np.pi * 17000 * t), 0.95 * np.sin(2 * np.pi * 17000 * t + 0.4)))
    result = process_audio(signal, sr, movement_depth=0, reverb_mix=0, output_ceiling_db=-2)
    assert _oversampled_true_peak(result) <= 10 ** (-2 / 20) + 2e-3
