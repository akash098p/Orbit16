# Orbit16 Studio

Offline-first stereo spatial audio effects for Windows desktop and a local browser interface.

> “16D” is a community label rather than a standardized audio format. Orbit16 creates a controllable stereo spatial-motion effect using DSP. It does not add true 3D source recordings or recover information missing from the source.

## Current implementation

Phase 1 foundation and Phase 2 interaction workflows are implemented. Phase 3 adds 4x oversampled true-peak estimation with static gain protection, integrated loudness (LUFS), stereo correlation, mono fold-down metrics, smoothed motion, and independent effect bypass controls. The app remains an offline-first creative stereo effect; it does not generate discrete object-based 3D audio.

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

## Quality and metering notes

The true-peak stage estimates inter-sample peaks by 4x oversampling and applies static gain reduction to meet the configured ceiling. It is not a look-ahead limiter or loudness normalizer. LUFS can be unavailable for silence or clips too short for valid meter blocks. Correlation and mono-fold-down measurements are diagnostic aids, not a substitute for listening tests. Phase 4 focuses on packaging and clean-machine validation.
