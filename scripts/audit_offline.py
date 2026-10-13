"""Basic static audit of production frontend assets for remote runtime URLs."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "frontend" / "dist"
if not (DIST / "index.html").is_file():
    print("ERROR: frontend/dist/index.html is missing; run npm run build first.")
    raise SystemExit(2)
external = re.compile(rb"https?://(?!127\.0\.0\.1(?::\d+)?(?:/|\b)|localhost(?::\d+)?(?:/|\b))", re.I)
findings = []
for path in DIST.rglob("*"):
    if path.is_file() and external.search(path.read_bytes()):
        findings.append(path.relative_to(ROOT).as_posix())
if findings:
    print("Potential external URLs found in production assets:")
    print("\n".join(f" - {item}" for item in findings))
    print("Review findings manually; this static check may flag documentation strings.")
    raise SystemExit(1)
print("PASS: no explicit non-loopback HTTP(S) URLs found in production frontend assets.")
