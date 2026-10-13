# Windows distribution and offline validation

## Build a Windows package

Use Windows 10/11 x64 with Python 3.12 x64, Node.js 20+, npm, and Git. From the repository root in PowerShell:

```powershell
.\scripts\build_windows.ps1
```

The onedir package is written to `dist/Orbit16Studio/`. Launch `Orbit16Studio.exe` from that folder and keep the complete folder together. This is a portable folder, not an MSI installer.

## FFmpeg dependency and licensing

Orbit16 Studio invokes FFmpeg as a separate executable to decode compressed audio. This repository does not bundle FFmpeg. Install a build that meets your licensing and distribution needs and ensure `ffmpeg.exe` is on PATH, or set `ORBIT16_FFMPEG` to its executable path.

FFmpeg licensing depends on the exact build configuration and enabled codecs. Some builds are LGPL-only; others enable GPL components. Before redistributing FFmpeg, inspect that binary's configuration and license notices and comply with the license applicable to that exact build. Do not assume every FFmpeg build has identical terms.

Python and JavaScript dependencies have their own licenses. Review an inventory for the exact release before commercial distribution. PyInstaller does not grant redistribution rights to packaged dependencies.

## Offline resource audit

After the frontend build, run:

```powershell
.\.venv\Scripts\python.exe scripts/audit_offline.py
```

This flags explicit non-loopback HTTP(S) URLs in built assets. It is a static check, not proof of offline safety. Test the packaged app with Wi-Fi disabled and confirm that audio processing, playback, analysis, presets and WAV export work without contacting external services.

## Clean-machine release checklist

- [ ] Build from a fresh clone with supported Python and Node.js versions.
- [ ] Run backend tests and frontend typecheck/build.
- [ ] Run the offline asset audit and manually review findings.
- [ ] Test WAV and compressed formats supported by the installed FFmpeg build.
- [ ] Test mono/stereo, silence, short clips, duration limits and output ceiling.
- [ ] Confirm source files are unchanged and temporary jobs are cleaned up.
- [ ] Test on a Windows account without development tools.
- [ ] Verify FFmpeg availability and the notices for the exact FFmpeg build.
- [ ] Review dependency licenses and generate release checksums.
- [ ] Sign binaries if a code-signing certificate is available.

## Scope and remaining release work

The current packaging script targets a portable PyInstaller `onedir` build and does not bundle FFmpeg. A signed installer, publishing automation, and exhaustive offline/network validation require a real Windows build and test environment; they are not claimed as completed here.
