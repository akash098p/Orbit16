import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Settings = { movement_depth: number; movement_rate: number; stereo_width: number; reverb_mix: number; output_ceiling_db: number; movement_enabled: boolean; width_enabled: boolean; reverb_enabled: boolean };
type Preset = { name: string; settings: Settings; builtin?: boolean };
type Completed = { id: string; sourceName: string; outputName: string; url: string; size: number };
type Analysis = { duration_seconds: number; sample_rate: number; channels: number; metrics: { integrated_lufs: number | null; true_peak_dbtp: number | null; stereo_correlation: number | null; mono_fold_down_db: number | null } };
const initialSettings: Settings = { movement_depth: 0.65, movement_rate: 0.12, stereo_width: 1.2, reverb_mix: 0.12, output_ceiling_db: -1, movement_enabled: true, width_enabled: true, reverb_enabled: true };
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

type LiveMode = "studio" | "orbit" | "wide" | "bass" | "dream" | "night";

function LiveAudition({ file, settings, mode, onModeChange }: { file: File | null; settings: Settings; mode: LiveMode; onModeChange: (mode: LiveMode) => void }) {
  const [volume, setVolume] = useState(0.8);
  const [bass, setBass] = useState(0);
  const [treble, setTreble] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("Choose a track, then press Play live.");
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const panRef = useRef<StereoPannerNode | null>(null);
  const bassRef = useRef<BiquadFilterNode | null>(null);
  const trebleRef = useRef<BiquadFilterNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const startAtRef = useRef(0);
  const offsetRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  function stopLive(reset = false) {
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    tickRef.current = null;
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    lfoRef.current?.stop();
    lfoRef.current?.disconnect();
    lfoGainRef.current?.disconnect();
    lfoRef.current = null;
    lfoGainRef.current = null;
    setPlaying(false);
    if (reset) { offsetRef.current = 0; setPosition(0); }
  }

  useEffect(() => {
    stopLive(true);
    bufferRef.current = null;
    setDuration(0);
    if (!file) { setMessage("Choose a track, then press Play live."); return; }
    let cancelled = false;
    setLoading(true);
    setMessage("Preparing local live preview…");
    (async () => {
      let temporary: AudioContext | null = null;
      try {
        temporary = new AudioContext();
        const buffer = await temporary.decodeAudioData(await file.arrayBuffer());
        if (cancelled) return;
        bufferRef.current = buffer;
        setDuration(buffer.duration);
        setMessage("Ready · effects respond while the track plays.");
      } catch {
        if (!cancelled) setMessage("Live preview could not decode this file in the browser. Try WAV or FLAC.");
      } finally {
        if (temporary && temporary.state !== "closed") await temporary.close();
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    if (gainRef.current && ctxRef.current) gainRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.025);
  }, [volume]);
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const profiles: Record<LiveMode, { pan: number; rate: number; bass: number; treble: number }> = {
      studio: { pan: 0, rate: 0, bass: 0, treble: 0 },
      orbit: { pan: settings.movement_enabled ? settings.movement_depth : 0, rate: settings.movement_rate, bass: 0, treble: 0 },
      wide: { pan: settings.movement_enabled ? settings.movement_depth * 0.25 : 0, rate: settings.movement_rate * 0.5, bass: 0, treble: 1.5 },
      bass: { pan: 0, rate: 0, bass: 5, treble: -1 },
      dream: { pan: settings.movement_enabled ? settings.movement_depth * 0.7 : 0, rate: settings.movement_rate * 0.7, bass: 2, treble: 2 },
      night: { pan: 0, rate: 0, bass: 2, treble: -5 },
    };
    const profile = profiles[mode];
    if (bassRef.current) bassRef.current.gain.setTargetAtTime(profile.bass + bass, ctx.currentTime, 0.04);
    if (trebleRef.current) trebleRef.current.gain.setTargetAtTime(profile.treble + treble, ctx.currentTime, 0.04);
    if (panRef.current) panRef.current.pan.setTargetAtTime(0, ctx.currentTime, 0.04);
    if (lfoGainRef.current) lfoGainRef.current.gain.setTargetAtTime(profile.pan, ctx.currentTime, 0.04);
    if (lfoRef.current && profile.rate > 0) lfoRef.current.frequency.setTargetAtTime(profile.rate, ctx.currentTime, 0.04);
    else if (lfoGainRef.current) lfoGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  }, [mode, settings.movement_enabled, settings.movement_depth, settings.movement_rate, bass, treble]);

  async function playLive() {
    const buffer = bufferRef.current;
    if (!buffer || playing) return;
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    await ctx.resume();
    const source = ctx.createBufferSource();
    const bassFilter = ctx.createBiquadFilter(); bassFilter.type = "lowshelf"; bassFilter.frequency.value = 180;
    const trebleFilter = ctx.createBiquadFilter(); trebleFilter.type = "highshelf"; trebleFilter.frequency.value = 4500;
    const pan = ctx.createStereoPanner();
    const gain = ctx.createGain(); gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(bassFilter); bassFilter.connect(trebleFilter); trebleFilter.connect(pan); pan.connect(gain); gain.connect(ctx.destination);
    bassRef.current = bassFilter; trebleRef.current = trebleFilter; panRef.current = pan; gainRef.current = gain;
    const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
    lfo.type = "sine"; lfo.frequency.value = settings.movement_rate; lfoGain.gain.value = mode === "studio" ? 0 : settings.movement_enabled ? settings.movement_depth : 0;
    lfo.connect(lfoGain); lfoGain.connect(pan.pan); lfo.start();
    lfoRef.current = lfo; lfoGainRef.current = lfoGain;
    const startOffset = Math.min(offsetRef.current, Math.max(0, buffer.duration - 0.01));
    startAtRef.current = ctx.currentTime - startOffset;
    sourceRef.current = source;
    source.onended = () => {
      if (sourceRef.current === source) { stopLive(true); setMessage("Playback finished."); }
    };
    source.start(0, startOffset);
    setPlaying(true); setMessage("LIVE · changes apply during playback");
    tickRef.current = window.setInterval(() => {
      const now = Math.min(buffer.duration, ctx.currentTime - startAtRef.current);
      offsetRef.current = now; setPosition(now);
    }, 100);
  }

  function pauseLive() {
    const ctx = ctxRef.current;
    if (playing && ctx) offsetRef.current = Math.min(duration, ctx.currentTime - startAtRef.current);
    stopLive(false);
    setPosition(offsetRef.current);
    setMessage("Paused · press Play live to resume.");
  }
  function seekLive(value: number) {
    offsetRef.current = value; setPosition(value);
    if (playing) { stopLive(false); void playLive(); }
  }
  useEffect(() => () => {
    stopLive(true);
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }, []);

  return <section className="live-panel">
    <div className="live-head"><div><div className="eyebrow accent">REAL-TIME AUDITION</div><h3>Live sound lab</h3><p>Browser-native live playback. Change the mode, EQ and level without exporting or reprocessing the track.</p></div><span className={playing ? "live-badge is-live" : "live-badge"}><i/>{playing ? "LIVE" : "READY"}</span></div>
    <div className="live-transport"><button className="primary-button" type="button" disabled={!file || loading || !bufferRef.current} onClick={() => playing ? pauseLive() : void playLive()}>{loading ? "Preparing…" : playing ? "Ⅱ Pause" : position > 0 ? "▶ Resume live" : "▶ Play live"}</button><button className="secondary-button" type="button" disabled={!file || loading} onClick={() => { stopLive(true); setMessage("Stopped."); }}>Stop</button><span className="live-time">{position.toFixed(1)} / {duration.toFixed(1)} sec</span></div>
    <input className="range live-seek" aria-label="Live playback position" type="range" min={0} max={Math.max(duration, 0.1)} step={0.1} value={Math.min(position, duration || 0)} disabled={!duration} onChange={e => seekLive(Number(e.target.value))}/>
    <div className="live-modes"><label>Listening mode<select value={mode} onChange={e => onModeChange(e.target.value as LiveMode)}><option value="studio">Studio / neutral</option><option value="orbit">Orbit 16D</option><option value="wide">Wide field</option><option value="bass">Bass focus</option><option value="dream">Dream space</option><option value="night">Night / soft highs</option></select></label><label className="live-volume">Monitor level <strong>{Math.round(volume * 100)}%</strong><input className="range" type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))}/></label></div>
    <div className="live-eq"><div><span>BASS</span><strong>{bass > 0 ? "+" : ""}{bass} dB</strong><input className="range" aria-label="Live bass EQ" type="range" min={-12} max={12} step={1} value={bass} onChange={e => setBass(Number(e.target.value))}/></div><div><span>TREBLE</span><strong>{treble > 0 ? "+" : ""}{treble} dB</strong><input className="range" aria-label="Live treble EQ" type="range" min={-12} max={12} step={1} value={treble} onChange={e => setTreble(Number(e.target.value))}/></div></div>
    <p className="live-message" role="status">{message}</p>
    <p className="analysis-note">Live modes are audition effects only; exported WAVs still use the offline DSP controls above. Keep monitor volume low before playback.</p>
  </section>;
}

function Control({ title, subtitle, value, label, min, max, step, onChange }: { title: string; subtitle: string; value: number; label: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <div className="control-card"><div className="control-top"><div><h4>{title}</h4><span>{subtitle}</span></div><output>{label}</output></div><input className="range" aria-label={title} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}/><div className="range-ends"><span>{min}</span><span>{max}</span></div></div>;
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [liveMode, setLiveMode] = useState<LiveMode>("orbit");
  const [settings, setSettings] = useState<Settings>(() => {
    try { return { ...initialSettings, ...JSON.parse(localStorage.getItem("orbit16.settings") || "{}") }; } catch { return initialSettings; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("orbit16.theme") || "dark");
  const [presets, setPresets] = useState<Preset[]>(() => {
    try { return [...builtinPresets, ...JSON.parse(localStorage.getItem("orbit16.presets") || "[]").map((p: Preset) => ({ ...p, settings: { ...initialSettings, ...p.settings } }))]; } catch { return builtinPresets; }
  });
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState<Completed[]>([]);
  const [status, setStatus] = useState("Ready for local processing");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRef = useRef(false);
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
  function toggleEffect(key: "movement_enabled" | "width_enabled" | "reverb_enabled") { setSettings(old => ({ ...old, [key]: !old[key] })); }
  async function analyzeSource() {
    if (!activeFile || analyzing) return;
    setAnalyzing(true); setError(""); setAnalysis(null);
    try { const body = new FormData(); body.append("file", activeFile); const response = await fetch("/api/analyze", { method: "POST", body }); if (!response.ok) { let message = `Analysis failed (${response.status})`; try { message = (await response.json()).detail ?? message; } catch {} throw new Error(message); } setAnalysis(await response.json()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Audio analysis failed."); }
    finally { setAnalyzing(false); }
  }
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
  function stop() { cancelRef.current = true; abortRef.current?.abort(); setStatus("Cancellation requested…"); }

  async function convertBatch() {
    if (!files.length || busy) return;
    const queue = [...files];
    setBusy(true); cancelRef.current = false; setCurrentIndex(0); setError("");
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
        const exportSettings = { ...settings };
        const exportProfiles: Record<LiveMode, Partial<Settings>> = {
          studio: { movement_depth: 0, movement_enabled: false, stereo_width: 1, reverb_mix: 0, width_enabled: false, reverb_enabled: false },
          orbit: {},
          wide: { movement_depth: Math.min(1, settings.movement_depth * 0.25), movement_rate: Math.max(0.02, settings.movement_rate * 0.5), stereo_width: 1.75, reverb_mix: 0.1 },
          bass: { movement_depth: 0, movement_enabled: false, stereo_width: 1.05, reverb_mix: 0.04 },
          dream: { movement_depth: Math.min(1, settings.movement_depth * 0.7), movement_rate: Math.max(0.02, settings.movement_rate * 0.7), stereo_width: 1.35, reverb_mix: 0.28 },
          night: { movement_depth: 0.08, movement_rate: 0.06, stereo_width: 1.1, reverb_mix: 0.06 },
        };
        Object.assign(exportSettings, exportProfiles[liveMode]);
        Object.entries(exportSettings).forEach(([key, value]) => body.append(key, String(value)));
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
    } finally { abortRef.current = null; setBusy(false); }
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
      <section className="hero"><div className="hero-copy"><div className="eyebrow accent">THE SPACE BETWEEN SOUNDS</div><h2>Make your music<br/>move <em>around you.</em></h2><p>Shape stereo movement, width, and ambience with an offline DSP engine. Your source always stays untouched.</p><div className="hero-tags"><span>STEREO DSP</span><span>LOSSLESS WAV CONTAINER</span><span>NO CLOUD</span></div></div><div className="orbit-visual" role="img" aria-label="Animated stereo field showing sound moving around a listener"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orbit-track track-one" aria-hidden="true"><span className="orbit-satellite"/></div><div className="orbit-track track-two" aria-hidden="true"><span className="orbit-satellite satellite-two"/></div><div className="orbit-core"><div className="core-dot"/></div><div className="orbit-label label-left">L <small>−90°</small></div><div className="orbit-label label-right">R <small>+90°</small></div><div className="orbit-label label-bottom">STEREO FIELD</div></div></section>
      <div className="section-heading"><div><div className="eyebrow">01 / SOURCE</div><h3>Choose your tracks</h3></div><span className="subtle">Local files only</span></div>
      <label className={`drop-zone ${files.length ? "has-file" : ""} ${dragging ? "dragging" : ""}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}><input type="file" multiple accept={audioAccept} onChange={choose}/><span className="upload-icon">↑</span><span className="drop-main">{files.length ? "Add more tracks or drop files here" : "Drop tracks here or browse files"}</span><span className="drop-sub">{fileLabel}</span><span className="browse-button">Browse audio</span></label>
      {files.length > 0 && <section className="queue-panel"><div className="queue-head"><strong>Batch queue <span>{files.length}</span></strong><button type="button" className="text-button" onClick={clearQueue} disabled={busy}>Clear queue</button></div><div className="queue-list">{files.map((f, i) => <div className="queue-item" key={`${f.name}-${f.size}-${f.lastModified}`}><span className="queue-number">{String(i + 1).padStart(2, "0")}</span><div className="queue-file"><strong>{f.name}</strong><small>{(f.size / 1024 / 1024).toFixed(2)} MB</small></div><span className="queue-state">{busy && i === currentIndex ? "PROCESSING" : "QUEUED"}</span></div>)}</div></section>}
      <Waveform file={activeFile} label={activeFile ? activeFile.name : "Source waveform"}/>
      <LiveAudition file={activeFile} settings={settings} mode={liveMode} onModeChange={setLiveMode}/>
      {activeFile && <section className="preview-panel"><div><div className="eyebrow">BEFORE / SOURCE</div><h3>Listen to original</h3></div><SourcePreview file={activeFile}/></section>}
      <section className="analysis-panel"><div className="analysis-head"><div><div className="eyebrow">SOURCE DIAGNOSTICS</div><h3>Listen with numbers</h3><p>Integrated loudness, estimated true peak, stereo correlation and mono fold-down compatibility.</p></div><button className="secondary-button" type="button" onClick={analyzeSource} disabled={!activeFile || analyzing}>{analyzing ? "Analysing…" : "Analyse source"}</button></div>{analysis && <div className="metrics-grid"><div className="metric"><span>INTEGRATED LOUDNESS</span><strong>{analysis.metrics.integrated_lufs == null ? "—" : `${analysis.metrics.integrated_lufs.toFixed(1)} LUFS`}</strong></div><div className="metric"><span>EST. TRUE PEAK</span><strong>{analysis.metrics.true_peak_dbtp == null ? "—" : `${analysis.metrics.true_peak_dbtp.toFixed(1)} dBTP`}</strong></div><div className="metric"><span>STEREO CORRELATION</span><strong>{analysis.metrics.stereo_correlation == null ? "—" : analysis.metrics.stereo_correlation.toFixed(2)}</strong></div><div className="metric"><span>MONO FOLD-DOWN</span><strong>{analysis.metrics.mono_fold_down_db == null ? "—" : `${analysis.metrics.mono_fold_down_db.toFixed(1)} dB`}</strong></div></div>}{analysis && <p className="analysis-note">{analysis.duration_seconds.toFixed(1)} sec · {analysis.sample_rate.toLocaleString()} Hz · {analysis.channels} source channel(s). Metrics are measurements, not a quality score.</p>}</section>
      <div className="section-heading effects-heading"><div><div className="eyebrow">02 / SOUND DESIGN</div><h3>Shape your space</h3></div><button className="reset-button" type="button" onClick={resetSettings}>↺ Reset</button></div>
      <section className="preset-panel"><div className="preset-load"><label>Load preset<select value={selectedPreset} onChange={e => loadPreset(e.target.value)}><option value="">Choose a sound profile…</option>{presets.map(p => <option key={p.name} value={p.name}>{p.name}{p.builtin ? " · built-in" : ""}</option>)}</select></label><button className="text-button" type="button" onClick={deletePreset} disabled={!selectedPreset || !!presets.find(p => p.name === selectedPreset)?.builtin}>Delete saved</button></div><div className="preset-save"><input aria-label="Preset name" placeholder="Name your preset" value={presetName} maxLength={40} onChange={e => setPresetName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") savePreset(); }}/><button type="button" className="secondary-button" onClick={savePreset}>Save current settings</button></div><p>Presets and controls are saved in this browser on this device.</p></section>
      <section className="effect-bypasses" aria-label="Effect enable switches"><label><input type="checkbox" checked={settings.movement_enabled} onChange={() => toggleEffect("movement_enabled")}/> Orbit movement</label><label><input type="checkbox" checked={settings.width_enabled} onChange={() => toggleEffect("width_enabled")}/> Stereo width</label><label><input type="checkbox" checked={settings.reverb_enabled} onChange={() => toggleEffect("reverb_enabled")}/> Room reverb</label></section>
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
