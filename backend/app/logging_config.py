"""Console and rotating-file logging."""
import logging
from logging.handlers import RotatingFileHandler
from app.config import settings

def configure_logging() -> None:
    settings.ensure_runtime_dirs()
    root = logging.getLogger()
    if root.handlers:
        return
    root.setLevel(getattr(logging, settings.log_level, logging.INFO))
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)
    log_file = RotatingFileHandler(settings.logs_dir / "orbit16.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    log_file.setFormatter(formatter)
    root.addHandler(log_file)
