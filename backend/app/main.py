"""Local API for offline audio conversion."""
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Annotated
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from app.audio_engine import process_audio\nfrom app.analysis import analyze_audio
from app.audio_io import AudioDecodeError, SUPPORTED_EXTENSIONS, decode_to_float_wav, read_float_wav, write_24bit_wav
from app.config import settings
from app.logging_config import configure_logging

configure_logging()
logger = logging.getLogger(__name__)
app = FastAPI(title="Orbit16 Studio", version="0.1.0", description="Local-only stereo spatial audio effects API.", docs_url="/api/docs", openapi_url="/api/openapi.json")

@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "processing": "local"}

@app.post("/api/convert")
async def convert(
    file: Annotated[UploadFile, File(description="Audio file to process")],
    movement_depth: Annotated[float, Form(ge=0, le=1)] = 0.65,
    movement_rate: Annotated[float, Form(ge=0.02, le=1)] = 0.12,
    stereo_width: Annotated[float, Form(ge=0, le=2)] = 1.2,
    reverb_mix: Annotated[float, Form(ge=0, le=0.5)] = 0.12,
    output_ceiling_db: Annotated[float, Form(ge=-12, le=-0.1)] = -1.0,
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported audio extension.")
    settings.ensure_runtime_dirs()
    job_dir = Path(tempfile.mkdtemp(prefix="job_", dir=settings.temp_dir))
    source, decoded, output = job_dir / ("source" + suffix), job_dir / "decoded.wav", job_dir / "orbit16_output.wav"
    try:
        total = 0
        with source.open("wb") as target:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    raise HTTPException(status_code=413, detail=f"Maximum upload size is {settings.max_upload_bytes // (1024 * 1024)} MB.")
                target.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        decode_to_float_wav(source, decoded)
        audio, sample_rate = read_float_wav(decoded)
        result = process_audio(audio, sample_rate, movement_depth=movement_depth, movement_rate=movement_rate, stereo_width=stereo_width, reverb_mix=reverb_mix, output_ceiling_db=output_ceiling_db)
        write_24bit_wav(output, result, sample_rate)
        logger.info("Converted duration %.2fs at %d Hz (%d input bytes)", len(audio) / sample_rate, sample_rate, total)
        return FileResponse(path=str(output), media_type="audio/wav", filename="orbit16_spatial.wav", background=BackgroundTask(shutil.rmtree, str(job_dir), ignore_errors=True))
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    except AudioDecodeError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.info("Input rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.exception("Unexpected conversion failure")
        raise HTTPException(status_code=500, detail="Audio conversion failed unexpectedly.")
    finally:
        await file.close()


@app.post("/api/analyze")
async def analyze(file: Annotated[UploadFile, File(description="Audio file to analyse")]) -> dict:
    """Decode a local audio upload and return loudness and stereo compatibility metrics."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported audio extension.")
    settings.ensure_runtime_dirs()
    job_dir = Path(tempfile.mkdtemp(prefix="analysis_", dir=settings.temp_dir))
    source, decoded = job_dir / ("source" + suffix), job_dir / "decoded.wav"
    try:
        total = 0
        with source.open("wb") as target:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    raise HTTPException(status_code=413, detail=f"Maximum upload size is {settings.max_upload_bytes // (1024 * 1024)} MB.")
                target.write(chunk)
        if total == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        decode_to_float_wav(source, decoded)
        audio, sample_rate = read_float_wav(decoded)
        duration = len(audio) / sample_rate
        if duration > settings.max_duration_seconds:
            raise HTTPException(status_code=413, detail=f"Maximum audio duration is {settings.max_duration_seconds} seconds.")
        metrics = analyze_audio(audio, sample_rate)
        return {"duration_seconds": round(duration, 3), "sample_rate": sample_rate, "channels": int(audio.shape[1] if audio.ndim > 1 else 1), "metrics": metrics}
    except HTTPException:
        raise
    except AudioDecodeError as exc:
        logger.info("Analysis input rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Audio analysis failed")
        raise HTTPException(status_code=500, detail="Audio analysis failed unexpectedly.")
    finally:
        await file.close()
        shutil.rmtree(job_dir, ignore_errors=True)

# Mount frontend last so API paths are not shadowed.
_frontend_dist = settings.project_root / "frontend" / "dist"
if (_frontend_dist / "index.html").is_file():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
