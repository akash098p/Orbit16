"""Development launcher for the shared local web UI."""

import os
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
import uvicorn
import webview

ROOT = Path(__file__).resolve().parents[1]


def wait_for_server(url: str, timeout: float = 15.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.2)
    return False


def main() -> None:
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT / "backend"))
    from app.main import app

    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="warning")
    )
    thread = threading.Thread(target=server.run, daemon=True, name="orbit16-api")
    thread.start()
    if not wait_for_server("http://127.0.0.1:8765/api/health"):
        server.should_exit = True
        raise RuntimeError("Orbit16 local API failed to start.")
    try:
        webview.create_window(
            "Orbit16 Studio",
            "http://127.0.0.1:8765",
            width=1280,
            height=860,
            min_size=(900, 620),
        )
        webview.start()
    finally:
        server.should_exit = True
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
