"""Paths and runtime settings."""

from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer.") from exc
    if value < 1:
        raise ValueError(f"{name} must be greater than zero.")
    return value


@dataclass(frozen=True)
class Settings:
    project_root: Path = PROJECT_ROOT
    app_name: str = "Orbit16 Studio"
    api_host: str = os.getenv("ORBIT16_HOST", "127.0.0.1")
    api_port: int = positive_int("ORBIT16_PORT", 8000)
    max_upload_bytes: int = positive_int("ORBIT16_MAX_UPLOAD_MB", 150) * 1024 * 1024
    max_duration_seconds: int = positive_int("ORBIT16_MAX_DURATION_SECONDS", 600)
    ffmpeg: str = os.getenv("ORBIT16_FFMPEG", "ffmpeg")
    log_level: str = os.getenv("ORBIT16_LOG_LEVEL", "INFO").upper()

    @property
    def home(self) -> Path:
        configured = os.getenv("ORBIT16_HOME", "").strip()
        return (
            Path(configured).expanduser().resolve()
            if configured
            else self.project_root / "data"
        )

    @property
    def temp_dir(self) -> Path:
        return self.home / "temp"

    @property
    def logs_dir(self) -> Path:
        return self.home / "logs"

    @property
    def config_dir(self) -> Path:
        return self.project_root / "config"

    def ensure_runtime_dirs(self) -> None:
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
