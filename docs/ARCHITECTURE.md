# Architecture

## Runtime
- React + TypeScript + Vite provides the browser UI and production build.
- FastAPI + Uvicorn provides a local loopback API.
- NumPy and Pedalboard provide offline stereo DSP.
- FFmpeg decodes supported local media; SoundFile reads samples and exports 24-bit PCM WAV.
- pywebview hosts the shared web UI in the Windows desktop wrapper.

## Data flow
1. The browser sends an audio file to POST /api/convert.
2. The API streams uploads to a managed temporary directory with a byte cap.
3. FFmpeg decodes locally; duration and channel count are checked.
4. DSP applies mid/side width, a moving stereo pan envelope, and optional reverb.
5. Peak attenuation limits the sample peak to a configured ceiling.
6. A new 24-bit WAV is returned; temporary job files are removed after response delivery.

## Limitations
- “16D” is a creative label; this engine modifies two-channel stereo.
- Processing operates on a full decoded track in memory and limits duration.
- Peak attenuation is not a look-ahead or true-peak limiter.
- Reverb and widening may affect phase; future work should add bypass and correlation meters.
- WAV export cannot restore detail lost in a lossy source.
- Decorative web fonts are currently loaded from an external source; a strict offline build should bundle fonts locally.

## Security
- Bind only to 127.0.0.1; do not expose the API to a LAN or public internet.
- Do not accept arbitrary file paths or FFmpeg arguments from users.
- Uploads are streamed and capped; files live in managed temporary directories.
