# Roadmap

## Phase 1 — Foundation
- Initial repository structure and documentation
- Python and frontend dependencies
- Runtime configuration and rotating logs
- Five theme JSON files and starter DSP presets
- Offline DSP engine and local API
- Responsive React interface with effect controls and WAV download
- Desktop pywebview launcher scaffold
- Unit tests and CI workflow

## Phase 2 — Playback and interaction
- [x] Browser-side waveform preview and source duration/sample-rate information
- [x] Original audio playback and processed-output audition
- [x] Multi-file batch queue with per-file status and aggregate progress
- [x] Cancel the active browser request and stop submitting remaining files
- [x] Load built-in sound profiles and save/delete custom presets in browser storage
- [x] Persist effect controls and appearance preference locally
- [x] Output names derived safely from source filenames
- [x] Include output-ceiling control in the UI
- [ ] Server-side job registry and cooperative cancellation during active DSP (future hardening)
- [ ] Sample-level processing progress reporting

## Phase 3 — DSP quality
- True-peak limiter and loudness analysis
- Phase correlation and mono-compatibility meter
- Smoothed movement trajectories and effect bypass
- Listening-test fixtures and reproducible benchmarks

## Phase 4 — Distribution
- FFmpeg packaging with applicable license notices
- PyInstaller build, Windows installer, and app icon
- Strict offline resource audit and clean-machine tests
- Release artifacts and regression workflow
