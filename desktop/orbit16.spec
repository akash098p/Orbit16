# PyInstaller spec for Orbit16 Studio (Windows, onedir).
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent.parent
datas = [
    (str(ROOT / "frontend" / "dist"), "frontend/dist"),
    (str(ROOT / "config"), "config"),
    (str(ROOT / "themes"), "themes"),
]
a = Analysis(
    [str(ROOT / "desktop" / "launcher.py")],
    pathex=[str(ROOT), str(ROOT / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=["webview", "webview.platforms.winforms", "uvicorn.logging", "uvicorn.loops.auto", "uvicorn.protocols.http.auto", "uvicorn.protocols.websockets.auto", "soundfile", "pedalboard", "pyloudnorm"],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter.test"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="Orbit16Studio", debug=False, bootloader_ignore_signals=False, strip=False, upx=False, console=False)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="Orbit16Studio")
