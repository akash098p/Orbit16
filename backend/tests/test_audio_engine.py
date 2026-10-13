import numpy as np
import pytest
from app.audio_engine import process_audio

def test_stereo_shape_finite_and_peak_guard():
    sr = 44100
    t = np.arange(sr, dtype=np.float32) / sr
    tone = 1.5 * np.sin(2 * np.pi * 440 * t)
    result = process_audio(np.column_stack((tone, tone)), sr, reverb_mix=0)
    assert result.shape == (sr, 2)
    assert result.dtype == np.float32
    assert np.isfinite(result).all()
    assert np.max(np.abs(result)) <= 10 ** (-1 / 20) + 1e-5

def test_mono_converts_to_stereo():
    result = process_audio(np.zeros(1024, dtype=np.float32), 44100, reverb_mix=0)
    assert result.shape == (1024, 2)

def test_zero_movement_unity_width_preserve_stereo():
    audio = np.full((512, 2), 0.05, dtype=np.float32)
    result = process_audio(audio, 44100, movement_depth=0, stereo_width=1, reverb_mix=0)
    np.testing.assert_allclose(result, audio, atol=1e-6)

@pytest.mark.parametrize("kwargs", [{"movement_depth": -0.1}, {"movement_rate": 0}, {"stereo_width": 3}, {"reverb_mix": 0.9}, {"output_ceiling_db": 1}])
def test_invalid_settings_raise(kwargs):
    with pytest.raises(ValueError):
        process_audio(np.zeros((128, 2), dtype=np.float32), 44100, **kwargs)
