import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Settings = { movement_depth: number; movement_rate: number; stereo_width: number; reverb_mix: number; output_ceiling_db: number };
type Preset = { name: string; settings: Settings; builtin?: boolean };
type Completed = { id: string; sourceName: string; outputName: string; url: string; size: number };
const initialSettings: Settings = { movement_depth: 0.65, movement_rate: 0.12, stereo_width: 1.2, reverb_mix: 0.12, output_ceiling_db: -1 };
const builtinPresets: Preset[] = [
  { name: "Gentle Orbit", builtin: true, settings: { ...initialSettings, movement_depth: 0.28, movement_rate: 0.08, stereo_width: 1.08, reverb_mix: 0.07 } },
  { name: "Deep Space", builtin: true, settings: { ...initialSettings, movement_depth: 0.88, movement_rate: 0.16, stereo_width: 1.55, reverb_mix: 0.2 } },
  { name: "Wide & Calm", builtin: true, settings: { ...initialSettings, movement_depth: 0.18, movement_rate: 0.06, stereo_width: 1.65, reverb_mix: 0.1 } },
];
const fmt = (n: number) => n.toFixed(2);
const audioAccept = ".wav,.flac,.mp3,.m4a,.aac,.ogg,.opus,.aiff,.aif";
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const outputNameFor = (name: string) => `${name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "audio"}_orbit16.wav`;

function Waveform({ file, label }: { file: File | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("Choose an audio file to inspect its waveform");
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#12131b"; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(183,243,107,.13)"; ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    if (!file) { setMessage("Choose an audio file to inspect its waveform"); return; }
    let cancelled = false;
    setMessage("Analysing waveform locally…");
    (async () => {
      let audioContext: AudioContext | undefined;
      try {
        audioContext = new AudioContext();
        const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
        if (cancelled) return;
        const channels = Math.min(buffer.numberOfChannels, 2);
        const middle = height / 2;
        ctx.strokeStyle = "#b7f36b"; ctx.lineWidth = 1;
        for (let x = 0; x < width; x++) {
          const start = Math.floor(x * buffer.length / width);
          const end = Math.max(start + 1, Math.floor((x + 1) * buffer.length / width));
          let peak = 0;
          for (let ch = 0; ch < channels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = start; i < Math.min(end, buffer.length); i++) peak = Math.max(peak, Math.abs(data[i]));
          }
          const amplitude = Math.max(1, peak * (height * 0.43));
          ctx.beginPath(); ctx.moveTo(x + .5, middle - amplitude); ctx.lineTo(x + .5, middle + amplitude); ctx.stroke();
        }
        setMessage(`${buffer.duration.toFixed(1)} sec · ${buffer.sampleRate.toLocaleString()} Hz · analysed in this browser`);
      } catch {
        if (!cancelled) setMessage("Browser preview unavailable for this format; conversion may still work with FFmpeg.");
      } finally {
        if (audioContext && audioContext.state !== "closed") void audioContext.close();
      }
    })();
    return () => { cancelled = true; };
  }, [file]);
  return <section className="waveform-panel"><div className="waveform-heading"><div><div className="eyebrow">LOCAL AUDIO ANALYSIS</div><h3>{label}</h3></div><span className="subtle">Waveform</span></div><canvas ref={canvasRef} width={1000} height={116} aria-label="Audio waveform visualization"/><p>{message}</p></section>;
}


function SourcePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return <audio controls preload="metadata" src={url || undefined}/>;
}

function Control({ title, subtitle, value, label, min, max, step, onChange }: { title: string; subtitle: string; value: number; label: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <div className="control-card"><div className="control-top"><div><h4>{title}</h4><span>{subtitle}</span></div><output>{label}</output></div><input className="range" aria-label={title} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}/><div className="range-ends"><span>{min}</span><span>{max}</span></div></div>;
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...initialSettings, ...JSON.parse(localStorage.getItem("orbit16.settings") || "{}") }; } catch { return initialSettings; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("orbit16.theme") || "dark");
  const [presets, setPresets] = useState<Preset[]>(() => {
    try { return [...builtinPresets, ...JSON.parse(localStorage.getItem("orbit16.presets") || "[]")]; } catch { return builtinPresets; }
  });
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<Completed[]>([]);
  const [status, setStatus] = useState("Ready for local processing");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);\n  const cancelRef = useRef(false);
  const activeFile = files[0] ?? null;
  const fileLabel = useMemo(() => files.length ? files.length === 1 ? `${files[0].name} · ${(files[0].size / 1024 / 1024).toFixed(1)} MB` : `${files.length} files queued · ${(files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(1)} MB total` : "WAV, FLAC, MP3, M4A, AAC, OGG", [files]);

  useEffect(() => { localStorage.setItem("orbit16.settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("orbit16.theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("orbit16.presets", JSON.stringify(presets.filter(p => !p.builtin))); }, [presets]);
  useEffect(() => () => { abortRef.current?.abort(); completed.forEach(item => URL.revokeObjectURL(item.url)); }, []);

  function update(key: keyof Settings, value: number) { setSettings(old => ({ ...old, [key]: value })); }
  function addFiles(list: FileList | File[]) {
    const accepted = Array.from(list).filter(f => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      return audioAccept.split(",").includes(ext);
    });
    if (!accepted.length) { setError("Choose a supported audio file (WAV, FLAC, MP3, M4A, AAC, OGG, OPUS or AIFF)."); return; }
    setFiles(old => [...old, ...accepted].filter((f, i, all) => all.findIndex(x => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified) === i));
    setError(""); setStatus(`${accepted.length} file(s) added to the queue`);
  }
  function choose(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); setDragging(false); if (event.dataTransfer.files) addFiles(event.dataTransfer.files); }
  function clearQueue() { if (busy) return; setFiles([]); setError(""); setStatus("Queue cleared"); }
  function resetSettings() { setSettings(initialSettings); setSelectedPreset(""); }
  function loadPreset(name: string) { const preset = presets.find(p => p.name === name); if (preset) { setSettings(preset.settings); setSelectedPreset(name); setStatus(`Preset loaded · ${name}`); } }
  function savePreset() {
    const name = presetName.trim();
    if (!name) { setError("Enter a name for your preset."); return; }
    if (presets.some(p => p.name.toLowerCase() === name.toLowerCase())) { setError("A preset with that name already exists."); return; }
    setPresets(old => [...old, { name, settings: { ...settings } }]); setSelectedPreset(name); setPresetName(""); setError(""); setStatus(`Preset saved locally · ${name}`);
  }
  function deletePreset() {
    const preset = presets.find(p => p.name === selectedPreset);
    if (!preset || preset.builtin) return;
    setPresets(old => old.filter(p => p.name !== preset.name)); setSelectedPreset(""); setStatus(`Removed preset · ${preset.name}`);
  }
  function stop() { cancelRef.current = true; setCancelRequested(true); abortRef.current?.abort(); setStatus("Cancellation requested…"); }

  async function convertBatch() {
    if (!files.length || busy) return;
    const queue = [...files];
    setBusy(true); cancelRef.current = false; setCancelRequested(false); setCurrentIndex(0); setError("");
    const newResults: Completed[] = [];
    setStatus(`Starting batch · ${queue.length} file(s)`);
    try {
      for (let i = 0; i < queue.length; i++) {
        if (abortRef.current?.signal.aborted) break;
        const source = queue[i];
        setCurrentIndex(i);
        setStatus(`Processing ${i + 1} of ${queue.length} · ${source.name}`);
        const controller = new AbortController(); abortRef.current = controller;
        const body = new FormData(); body.append("file", source);
        Object.entries(settings).forEach(([key, value]) => body.append(key, String(value)));
        const response = await fetch("/api/convert", { method: "POST", body, signal: controller.signal });
        if (!response.ok) {
          let message = `Conversion failed (${response.status})`;
          try { message = (await response.json()).detail ?? message; } catch { /* response was not JSON */ }
          throw new Error(`${source.name}: ${message}`);
        }
        const blob = await response.blob();
        newResults.push({ id: makeId(), sourceName: source.name, outputName: outputNameFor(source.name), url: URL.createObjectURL(blob), size: blob.size });
        setCompleted(old => [...old, newResults[newResults.length - 1]]);
      }
      if (cancelRef.current || abortRef.current?.signal.aborted) setStatus(`Stopped · ${newResults.length} of ${queue.length} file(s) completed`);
      else setStatus(`Batch complete · ${newResults.length} of ${queue.length} file(s) exported`);
      if (newResults.length) setFiles(old => old.filter(f => !queue.includes(f)));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") setStatus(`Cancelled · ${newResults.length} file(s) completed`);
      else { setError(reason instanceof Error ? reason.message : "Conversion failed."); setStatus("Batch stopped after an error"); }
    } finally { abortRef.current = null; setBusy(false); setCancelRequested(false); }
  }

  function download(item: Completed) {
    const anchor = document.createElement("a"); anchor.href = item.url; anchor.download = item.outputName;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  }

  return <div className="app-shell" data-theme={theme}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark" aria-hidden="true"><span/><span/><span/></div><div><strong>ORBIT<span>16</span></strong><small>STUDIO</small></div></div>
      <div className="side-section-label">WORKSPACE</div>
      <button className="side-link active" type="button"><span>◉</span> Spatial Studio</button>
      <button className="side-link" type="button" onClick={resetSettings}><span>↺</span> Reset controls</button>
      <div className="sidebar-bottom"><div className="offline-pill"><i/> OFFLINE ENGINE</div><p>Audio stays on your device. No cloud processing.</p><label className="theme-select">Appearance<select value={theme} onChange={e => setTheme(e.target.value)}><option value="dark">Midnight</option><option value="light">Light</option></select></label><div className="version">PHASE 2 · WORKFLOW</div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><div className="eyebrow">SPATIAL AUDIO WORKSTATION</div><h1>Spatial Studio</h1></div><div className="local-tag"><span className="lock">⌑</span> LOCAL SESSION</div></header>
      <section className="hero"><div className="hero-copy"><div className="eyebrow accent">THE SPACE BETWEEN SOUNDS</div><h2>Make your music<br/>move <em>around you.</em></h2><p>Shape stereo movement, width, and ambience with an offline DSP engine. Your source always stays untouched.</p><div className="hero-tags"><span>STEREO DSP</span><span>LOSSLESS WAV CONTAINER</span><span>NO CLOUD</span></div></div><div className="orbit-visual" aria-label="Decorative spatial audio orbit visualization"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orbit-core"><div className="core-dot"/></div><div className="orbit-label label-left">L <small>−90°</small></div><div className="orbit-label label-right">R <small>+90°</small></div><div className="orbit-label label-bottom">STEREO FIELD</div></div></section>
      <div className="section-heading"><div><div className="eyebrow">01 / SOURCE</div><h3>Choose your tracks</h3></div><span className="subtle">Local files only</span></div>
      <label className={`drop-zone ${files.length ? "has-file" : ""} ${dragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}><input type="file" multiple accept={audioAccept} onChange={choose}/><span className="upload-icon">↑</span><span className="drop-main">{files.length ? "Add more tracks or drop files here" : "Drop tracks here or browse files"}</span><span className="drop-sub">{fileLabel}</span><span className="browse-button">Browse audio</span></label>
      {files.length > 0 && <section className="queue-panel"><div className="queue-head"><strong>Batch queue <span>{files.length}</span></strong><button type="button" className="text-button" onClick={clearQueue} disabled={busy}>Clear queue</button></div><div className="queue-list">{files.map((f, i) => <div className="queue-item" key={`${f.name}-${f.size}-${f.lastModified}`}><span className="queue-number">{String(i + 1).padStart(2, "0")}</span><div className="queue-file"><strong>{f.name}</strong><small>{(f.size / 1024 / 1024).toFixed(2)} MB</small></div><span className="queue-state">{busy && i === currentIndex ? "PROCESSING" : "QUEUED"}</span></div>)}</div></section>}
      <Waveform file={activeFile} label={activeFile ? activeFile.name : "Source waveform"}/>
      {activeFile && <section className="preview-panel"><div><div className="eyebrow">BEFORE / SOURCE</div><h3>Listen to original</h3></div><SourcePreview file={activeFile}/></section>}
      <div className="section-heading effects-heading"><div><div className="eyebrow">02 / SOUND DESIGN</div><h3>Shape your space</h3></div><button className="reset-button" type="button" onClick={resetSettings}>↺ Reset</button></div>
      <section className="preset-panel"><div className="preset-load"><label>Load preset<select value={selectedPreset} onChange={e => loadPreset(e.target.value)}><option value="">Choose a sound profile…</option>{presets.map(p => <option key={p.name} value={p.name}>{p.name}{p.builtin ? " · built-in" : ""}</option>)}</select></label><button className="text-button" type="button" onClick={deletePreset} disabled={!selectedPreset || !!presets.find(p => p.name === selectedPreset)?.builtin}>Delete saved</button></div><div className="preset-save"><input aria-label="Preset name" placeholder="Name your preset" value={presetName} maxLength={40} onChange={e => setPresetName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") savePreset(); }}/><button type="button" className="secondary-button" onClick={savePreset}>Save current settings</button></div><p>Presets and controls are saved in this browser on this device.</p></section>
      <section className="controls-grid">
        <Control title="Orbit depth" subtitle="LEFT ↔ RIGHT SWEEP" value={settings.movement_depth} label={fmt(settings.movement_depth)} min={0} max={1} step={0.01} onChange={v => update("movement_depth", v)}/>
        <Control title="Movement speed" subtitle="ORBIT RATE" value={settings.movement_rate} label={`${fmt(settings.movement_rate)} Hz`} min={0.02} max={1} step={0.01} onChange={v => update("movement_rate", v)}/>
        <Control title="Stereo width" subtitle="MID / SIDE WIDTH" value={settings.stereo_width} label={fmt(settings.stereo_width)} min={0} max={2} step={0.05} onChange={v => update("stereo_width", v)}/>
        <Control title="Room ambience" subtitle="STEREO REVERB" value={settings.reverb_mix} label={`${Math.round(settings.reverb_mix * 100)}%`} min={0} max={0.5} step={0.01} onChange={v => update("reverb_mix", v)}/>
        <Control title="Output ceiling" subtitle="SAMPLE-PEAK TARGET · DBFS" value={settings.output_ceiling_db} label={`${settings.output_ceiling_db.toFixed(1)} dB`} min={-12} max={-0.1} step={0.1} onChange={v => update("output_ceiling_db", v)}/>
      </section>
      <section className="export-panel"><div className="export-info"><div className="export-icon">♫</div><div><div className="eyebrow">03 / EXPORT</div><h3>Studio WAV</h3><p>24-bit PCM · Original sample rate · Stereo</p></div></div><div className="export-actions">{busy && <button className="secondary-button cancel-button" type="button" onClick={stop}>Cancel batch</button>}<button className="primary-button" type="button" onClick={convertBatch} disabled={!files.length || busy}>{busy ? <><span className="spinner"/> Processing {currentIndex + 1}/{files.length}…</> : <>Process queue <span>↗</span></>}</button></div></section>
      {busy && <div className="progress-wrap" role="status"><div className="progress-label"><span>{status}</span><span>{files.length ? Math.min(currentIndex, files.length) : 0}/{files.length}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${files.length ? currentIndex / files.length * 100 : 0}%` }}/></div><p>Progress is tracked per file; individual DSP processing does not yet report sample-level progress.</p></div>}
      <div className="status-line"><span className={busy ? "status-dot working" : "status-dot"}/>{status}</div>
      {error && <div className="error-message" role="alert">{error}</div>}
      {completed.length > 0 && <section className="results-section"><div className="section-heading"><div><div className="eyebrow accent">04 / RESULTS</div><h3>Processed audio</h3></div><button className="text-button" type="button" onClick={() => { completed.forEach(item => URL.revokeObjectURL(item.url)); setCompleted([]); }}>Clear results</button></div>{completed.map(item => <article className="result-card" key={item.id}><div className="result-file"><span className="result-file-icon">♫</span><div><strong>{item.outputName}</strong><small>{item.sourceName} · {(item.size / 1024 / 1024).toFixed(2)} MB · 24-bit WAV</small></div></div><audio controls preload="metadata" src={item.url}/><button className="secondary-button" type="button" onClick={() => download(item)}>Download WAV ↓</button></article>)}</section>}
      <footer><span>ORBIT16 STUDIO <b>·</b> LOCAL DSP</span><span>YOUR AUDIO NEVER LEAVES THIS DEVICE</span></footer>
    </main>
  </div>;
}
