# Orbit16 Studio

Offline-first stereo spatial audio effects for Windows desktop and a local browser interface.

> “16D” is a community label rather than a standardized audio format. Orbit16 creates a controllable stereo spatial-motion effect using DSP. It does not add true 3D source recordings or recover information missing from the source.

## Phase 1 — Foundation

This repository contains the project layout, backend DSP foundation, configuration and theme files, logging, tests, frontend shell, desktop launcher scaffold, and setup documentation. This phase establishes the foundation; it is not yet the complete end-user converter.

## Targets

- Local/offline processing; no cloud API or audio upload.
- Shared engine for the React browser UI and Windows desktop wrapper.
- Non-destructive source handling and explicit output paths.
- Stereo movement, mid/side width, reverb, safe peak handling, high-quality WAV export.
- Configurable logging, themes, presets, and tests.

## Requirements

- Windows 10/11 (development target)
- Python 3.12 recommended
- Node.js 20+ and npm
- FFmpeg installed locally and available on `PATH` for MP3/M4A/AAC/Ogg decoding

## Quick start

1. Create and activate a virtual environment in the repository root:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

2. Check that `ffmpeg -version` works if you need compressed input formats.
3. Start the API from the repository root:

   ```powershell
   uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
   ```

4. In a second terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open the local Vite URL shown in the terminal. The UI uses a Vite proxy to the loopback-only API.

For the desktop wrapper, build the frontend first, then run the launcher from the repository root:

   ```powershell
   cd frontend
   npm run build
   cd ..
   python desktop/launcher.py
   ```

The desktop launcher serves the built UI through the same local API on loopback port 8765.

## Security and privacy

- Bind the service to `127.0.0.1`, not `0.0.0.0`.
- Do not expose the local API to a LAN or the public internet.
- Uploads are bounded and processed into managed temporary jobs; files are removed after response delivery.
- Input files are read only; the application creates new output files.

## Audio quality notes

Use lossless input where possible. Exporting a lossy MP3 to 24-bit WAV does not restore lost detail. The initial effects are creative DSP, not a guarantee of perceptually better sound. Always compare bypass and processed audio on headphones and speakers.

## Phase 1 status

Foundation only. Later phases should add real-time audition, waveform display, robust progress/cancellation, preset management, batch jobs, calibrated loudness analysis, a true-peak limiter, packaging, installer, and release validation.
