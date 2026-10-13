# Roadmap

## Phase 1 — Foundation
- [x] Repository structure, configuration, themes, logs, tests and CI
- [x] Offline DSP engine and local conversion API
- [x] React interface and desktop launcher scaffold

## Phase 2 — Playback and interaction
- [x] Browser waveform and original/output playback
- [x] Multi-file queue, per-file status and browser-request cancellation
- [x] Built-in and user-saved presets; persisted settings and appearance
- [x] Output ceiling control and safe output naming

## Phase 3 — DSP quality and metering
- [x] 4x oversampled inter-sample peak estimation and static true-peak ceiling guard
- [x] Integrated loudness (LUFS), stereo correlation and mono fold-down metrics
- [x] Independent bypass toggles and smoothed movement
- [x] Configured maximum-duration enforcement and unit tests
- [ ] Look-ahead limiting with gain-reduction metering
- [ ] Listening-test fixtures and reproducible DSP benchmarks

## Phase 5 — Live audition and performance controls
- [x] Browser-native live playback using Web Audio API
- [x] Instant listening modes: Studio, Orbit 16D, Wide Field, Bass Focus, Dream Space, Night
- [x] Live monitor level, seek/pause/resume, bass and treble EQ controls
- [x] Existing offline conversion/export path remains unchanged
- [ ] Add live reverb/width processing and compare live chain against offline render
- [ ] Run frontend CI/typecheck and test on Chromium/Firefox/Safari where available

## Phase 4 — Distribution
- [x] PyInstaller onedir packaging specification
- [x] Windows PowerShell build script
- [x] FFmpeg licensing/distribution guidance
- [x] Static offline-resource audit and CI integration
- [x] MIT project license
- [ ] Build and smoke-test packaged app on Windows
- [ ] Signed installer, release artifacts, and checksums
- [ ] Full clean-machine and network-disabled validation

## Release status
The repository now contains the build and audit tooling. A Windows package, signed installer, and offline clean-machine test are not marked complete until they have actually run on Windows. FFmpeg is intentionally not bundled; distribution depends on the selected FFmpeg build and its license.
