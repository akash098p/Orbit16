"""Local-only decoding and WAV export helpers."""
import shutil
import subprocess
from pathlib import Path
import soundfile as sf
from app.config import settings

SUPPORTED_EXTENSIONS = {".wav", ".flac", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".aiff", ".aif"}

class AudioDecodeError(ValueError):
    """Raised for unsupported or undecodable input."""

def require_ffmpeg() -> str:
    binary = shutil.which(settings.ffmpeg)
    if not binary:
        raise AudioDecodeError("FFmpeg not found. Install it or set ORBIT16_FFMPEG.")
    return binary

def decode_to_float_wav(source: Path, destination: Path) -> None:
    if source.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise AudioDecodeError("Unsupported audio extension.")
    command = [require_ffmpeg(), "-nostdin", "-hide_banner", "-v", "error", "-y", "-i", str(source), "-map", "0:a:0", "-vn", "-sn", "-dn", "-c:a", "pcm_f32le", str(destination)]
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=180)
    except subprocess.TimeoutExpired as exc:
        raise AudioDecodeError("Audio decoding timed out.") from exc
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", errors="replace").strip()
        raise AudioDecodeError(detail[-600:] or "Could not decode audio.") from exc

def read_float_wav(path: Path):
    info = sf.info(str(path))
    if info.frames <= 0 or info.samplerate <= 0:
        raise AudioDecodeError("Decoded audio is empty or invalid.")
    if info.duration > settings.max_duration_seconds:
        raise AudioDecodeError(f"Maximum supported duration is {settings.max_duration_seconds} seconds.")
    samples, sample_rate = sf.read(str(path), dtype="float32", always_2d=True)
    if samples.shape[1] not in (1, 2):
        raise AudioDecodeError("Only mono or stereo audio is supported.")
    return samples, sample_rate

def write_24bit_wav(path: Path, audio, sample_rate: int) -> None:
    sf.write(str(path), audio, sample_rate, subtype="PCM_24", format="WAV")
