# Orbit16 Studio

Offline-first stereo spatial audio effects for Windows desktop and a local browser interface.

> “16D” is a community label rather than a standardized audio format. Orbit16 creates a controllable stereo spatial-motion effect using DSP. It does not add true 3D source recordings or recover information missing from the source.

## Implementation

- Phase 1: local API, shared DSP engine, React interface, themes, configuration, logs and tests.
- Phase 2: waveform/source/output playback, batch queue, saved presets, persistent controls and per-file status.
- Phase 3: oversampled true-peak estimation with static gain protection, LUFS/stereo/mono diagnostics, smoothed motion and effect bypass.
- Phase 4 tooling: PyInstaller onedir spec, Windows build script, offline asset audit, distribution notes and MIT license.

The app is an offline-first creative stereo effect; it does not generate discrete object-based 3D audio. The peak stage is static gain reduction, not a look-ahead limiter or loudness normalizer.

## Live Sound Lab exports

The Live Sound Lab includes a direct **Download live mix** action, separate from **Record mix**:

- **MP3 · compact** — encode the rendered live mix at 128, 192 or 320 kbps.
- **WAV · lossless** — download the rendered mix as uncompressed 16-bit PCM WAV.
- The browser renders the selected live mode, motion pattern and bass/treble settings before export. MP3 compression is performed locally by the FastAPI backend with FFmpeg.
- If the backend or MP3 encoder is unavailable, the export flow falls back to downloading the rendered WAV where possible. WAV files are much larger than MP3 files.

For MP3 export, keep the local API running on `127.0.0.1:8000` and make sure FFmpeg is installed and available on `PATH`. Check the API at [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health). If MP3 export fails, inspect the backend terminal and run `ffmpeg -version` in PowerShell.

Note: the direct live-mix renderer is a browser-side rendering of the selected live mode and its supported EQ/motion controls; it is not guaranteed to reproduce every effect in the separate full offline DSP conversion pipeline.

## Requirements

- Windows 10/11 x64 for desktop packaging
- Python 3.12 recommended
- Node.js 20+ and npm
- FFmpeg on PATH for compressed audio decoding (not bundled)

## Development quick start

PowerShell from the repository root:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

Start the local API in one terminal:

```powershell
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local Vite URL printed by the command. The frontend proxies API calls to loopback only.

## Build a Windows portable folder

On Windows with Python 3.12 x64, Node.js and npm installed:

```powershell
.\scripts\build_windows.ps1
```

The portable onedir output is `dist/Orbit16Studio/`; launch `Orbit16Studio.exe` from that folder. Keep the entire folder together. This is not an MSI installer and has not been declared release-tested until built and smoke-tested on Windows.

Run the offline resource audit after building the frontend:

```powershell
.\.venv\Scripts\python.exe scripts/audit_offline.py
```

See [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) for FFmpeg licensing, clean-machine tests and release checklist.

## Security and privacy

- Bind the service to `127.0.0.1`, not `0.0.0.0`.
- Do not expose the local API to a LAN or public internet.
- Uploads are bounded and processed in temporary job folders; input files are read only.
- The static offline audit is a heuristic, not proof that all code paths are offline-safe.

## Audio quality notes

Use lossless input where possible. Exporting lossy MP3 to 24-bit WAV does not restore lost detail. LUFS may be unavailable for silence or clips too short for valid meter blocks. Stereo correlation and mono fold-down metrics are diagnostic aids, not substitutes for listening tests. Always compare bypass and processed audio on headphones and speakers.

## License

Project source is MIT licensed; dependencies and any separately installed FFmpeg build have their own license terms. Review those terms before redistribution.
