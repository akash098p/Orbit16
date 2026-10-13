# Roadmap

## Phase 1 — Foundation
- [x] Repository structure, configuration, themes, logs, tests and CI
- [x] Offline DSP engine and local conversion API
- [x] React interface and desktop launcher scaffold

## Phase 2 — Playback and interaction
- [x] Browser waveform and original/output playback
- [x] Multi-file queue, per-file status and cancellation of the browser request
- [x] Built-in and user-saved presets; persisted settings and appearance
- [x] Output ceiling control and safe output naming

## Phase 3 — DSP quality and metering
- [x] 4x oversampled inter-sample peak estimation and static true-peak ceiling guard
- [x] Integrated loudness (LUFS) analysis
- [x] Stereo correlation and mono fold-down compatibility metrics
- [x] Independent bypass toggles for movement, width and reverb
- [x] Smoothed movement trajectory
- [x] Configured maximum-duration enforcement in conversion and analysis
- [x] Unit tests for metering and peak protection
- [ ] Look-ahead limiting with gain-reduction metering (future improvement)
- [ ] Listening-test fixtures and reproducible DSP benchmarks

## Phase 4 — Distribution
- [ ] Bundle or document FFmpeg licensing and distribution options
- [ ] PyInstaller build, Windows installer, and app icon
- [ ] Strict offline resource audit and clean-machine tests
- [ ] Release artifacts and regression workflow
