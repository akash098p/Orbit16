import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Settings = { movement_depth: number; movement_rate: number; stereo_width: number; reverb_mix: number };
const initialSettings: Settings = { movement_depth: 0.65, movement_rate: 0.12, stereo_width: 1.2, reverb_mix: 0.12 };
const fmt = (n: number) => n.toFixed(2);

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready for local processing");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState("dark");
  const fileLabel = useMemo(() => file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : "WAV, FLAC, MP3, M4A, AAC, OGG", [file]);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  function update(key: keyof Settings, value: number) { setSettings((old) => ({ ...old, [key]: value })); }
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next); setError(""); setResultUrl(null);
    setStatus(next ? "Track ready · processed locally" : "Ready for local processing");
  }
  async function convert() {
    if (!file || busy) return;
    setBusy(true); setError(""); setStatus("Processing on this computer…");
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    const body = new FormData();
    body.append("file", file);
    Object.entries(settings).forEach(([key, value]) => body.append(key, String(value)));
    try {
      const response = await fetch("/api/convert", { method: "POST", body });
      if (!response.ok) {
        let message = `Conversion failed (${response.status})`;
        try { message = (await response.json()).detail ?? message; } catch { /* non-JSON error */ }
        throw new Error(message);
      }
      setResultUrl(URL.createObjectURL(await response.blob()));
      setStatus("Conversion complete · 24-bit PCM WAV");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversion failed.");
      setStatus("Unable to convert");
    } finally { setBusy(false); }
  }

  return <div className="app-shell" data-theme={theme}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark" aria-hidden="true"><span/><span/><span/></div><div><strong>ORBIT<span>16</span></strong><small>STUDIO</small></div></div>
      <div className="side-section-label">WORKSPACE</div>
      <button className="side-link active" type="button"><span>◉</span> Spatial Studio</button>
      <button className="side-link" type="button" onClick={() => setSettings(initialSettings)}><span>↺</span> Reset controls</button>
      <div className="sidebar-bottom">
        <div className="offline-pill"><i/> OFFLINE ENGINE</div><p>Audio stays on your device. No cloud processing.</p>
        <label className="theme-select">Appearance<select value={theme} onChange={(e) => setTheme(e.target.value)}><option value="dark">Midnight</option><option value="light">Light</option></select></label>
        <div className="version">PHASE 1 · FOUNDATION</div>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><div className="eyebrow">SPATIAL AUDIO WORKSTATION</div><h1>Spatial Studio</h1></div><div className="local-tag"><span className="lock">⌑</span> LOCAL SESSION</div></header>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow accent">THE SPACE BETWEEN SOUNDS</div><h2>Make your music<br/>move <em>around you.</em></h2><p>Shape stereo movement, width, and ambience with an offline DSP engine. Your source always stays untouched.</p><div className="hero-tags"><span>STEREO DSP</span><span>LOSSLESS EXPORT</span><span>NO CLOUD</span></div></div>
        <div className="orbit-visual" aria-label="Decorative spatial audio orbit visualization"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orbit-core"><div className="core-dot"/></div><div className="orbit-label label-left">L <small>−90°</small></div><div className="orbit-label label-right">R <small>+90°</small></div><div className="orbit-label label-bottom">STEREO FIELD</div></div>
      </section>
      <div className="section-heading"><div><div className="eyebrow">01 / SOURCE</div><h3>Choose your track</h3></div><span className="subtle">Local files only</span></div>
      <label className={`drop-zone ${file ? "has-file" : ""}`}><input type="file" accept=".wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,.aiff,.aif,audio/*" onChange={choose}/><span className="upload-icon">↑</span><span className="drop-main">{file ? "Track ready" : "Drop a song here or browse files"}</span><span className="drop-sub">{fileLabel}</span><span className="browse-button">Browse audio</span></label>
      <div className="section-heading effects-heading"><div><div className="eyebrow">02 / SOUND DESIGN</div><h3>Shape your space</h3></div><button className="reset-button" type="button" onClick={() => setSettings(initialSettings)}>↺ Reset</button></div>
      <section className="controls-grid">
        <Control title="Orbit depth" subtitle="LEFT ↔ RIGHT SWEEP" value={settings.movement_depth} label={fmt(settings.movement_depth)} min={0} max={1} step={0.01} onChange={(v) => update("movement_depth", v)}/>
        <Control title="Movement speed" subtitle="ORBIT RATE" value={settings.movement_rate} label={`${fmt(settings.movement_rate)} Hz`} min={0.02} max={1} step={0.01} onChange={(v) => update("movement_rate", v)}/>
        <Control title="Stereo width" subtitle="MID / SIDE WIDTH" value={settings.stereo_width} label={fmt(settings.stereo_width)} min={0} max={2} step={0.05} onChange={(v) => update("stereo_width", v)}/>
        <Control title="Room ambience" subtitle="STEREO REVERB" value={settings.reverb_mix} label={`${Math.round(settings.reverb_mix * 100)}%`} min={0} max={0.5} step={0.01} onChange={(v) => update("reverb_mix", v)}/>
      </section>
      <section className="export-panel"><div className="export-info"><div className="export-icon">♫</div><div><div className="eyebrow">03 / EXPORT</div><h3>Studio WAV</h3><p>24-bit PCM · Original sample rate · Stereo</p></div></div><button className="primary-button" type="button" onClick={convert} disabled={!file || busy}>{busy ? <><span className="spinner"/> Processing…</> : <>Create spatial audio <span>↗</span></>}</button></section>
      <div className="status-line"><span className={busy ? "status-dot working" : "status-dot"}/>{status}</div>
      {error && <div className="error-message" role="alert">{error}</div>}
      {resultUrl && <section className="result-panel"><div><div className="eyebrow accent">READY TO LISTEN</div><h3>Your spatial mix is ready</h3></div><audio controls src={resultUrl}/><a className="download-link" href={resultUrl} download="orbit16-spatial.wav">Download WAV ↓</a></section>}
      <footer><span>ORBIT16 STUDIO <b>·</b> PHASE 1</span><span>Creative stereo DSP · Always compare with bypass</span></footer>
    </main>
  </div>;
}

function Control(props: { title: string; subtitle: string; value: number; label: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <div className="control-card"><div className="control-top"><div><h4>{props.title}</h4><span>{props.subtitle}</span></div><output>{props.label}</output></div><input aria-label={props.title} className="range" type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}/><div className="range-ends"><span>{props.min}</span><span>{props.max}</span></div></div>;
}
