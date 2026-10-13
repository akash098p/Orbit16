from pathlib import Path
from app.config import settings

def test_settings_are_sane():
    assert isinstance(settings.project_root, Path)
    assert isinstance(settings.temp_dir, Path)
    assert settings.max_upload_bytes > 0
    assert settings.max_duration_seconds > 0
