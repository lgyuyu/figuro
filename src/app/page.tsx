"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import STLPreview from "@/components/STLPreview";
import AIModelPreview from "@/components/AIModelPreview";
import { imageDataToHeightMap, imageDataToSTL, smoothHeightMap, DEFAULT_PARAMS, type ReliefParams } from "@/lib/stl-engine";

type Mode = "relief" | "ai";

export default function Home() {
  const [mode, setMode] = useState<Mode>("relief");
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header mode={mode} setMode={setMode} />
      {mode === "relief" ? <ReliefMode /> : <AIMode />}
    </div>
  );
}

function Header({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎨</div>
      <div style={{ flex: 1 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Figuro</h1>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>2D image to 3D model to STL print</p>
      </div>
      <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
        <ModeButton active={mode === "relief"} onClick={() => setMode("relief")} icon="🏔️" label="浮雕" />
        <ModeButton active={mode === "ai"} onClick={() => setMode("ai")} icon="🤖" label="AI转3D" />
      </div>
    </header>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: active ? "var(--accent)" : "transparent", color: active ? "#fff" : "var(--text-dim)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}

// ============ Relief Mode ============
function ReliefMode() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [heightMap, setHeightMap] = useState<Float32Array | null>(null);
  const [previewHeightMap, setPreviewHeightMap] = useState<Float32Array | null>(null);
  const [params, setParams] = useState<ReliefParams>(DEFAULT_PARAMS);
  const [generating, setGenerating] = useState(false);
  const [stlSize, setStlSize] = useState("");
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please upload an image file"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 200; let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) { const s = MAX_DIM / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const canvas = canvasRef.current!; canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h); setImageData(data); setImgDimensions({ w, h });
        setHeightMap(imageDataToHeightMap(data, params.invert));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [params.invert]);

  useEffect(() => {
    if (!heightMap || !imageData) return;
    setPreviewHeightMap(smoothHeightMap(heightMap, imageData.width, imageData.height, params.smoothPasses));
  }, [heightMap, imageData, params.smoothPasses]);

  const generateSTL = useCallback(() => {
    if (!imageData) return; setGenerating(true);
    setTimeout(() => {
      try {
        const stl = imageDataToSTL(imageData, params);
        const blob = new Blob([stl], { type: "model/stl" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a");
        a.href = url; a.download = "figuro_relief_" + Date.now() + ".stl"; a.click(); URL.revokeObjectURL(url);
        setStlSize(blob.size > 1048576 ? (blob.size / 1048576).toFixed(1) + " MB" : (blob.size / 1024).toFixed(1) + " KB");
      } catch (err) { alert("Error: " + (err as Error).message); }
      setGenerating(false);
    }, 50);
  }, [imageData, params]);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ flex: 1, display: "flex", gap: 1, background: "var(--border)", minHeight: 0 }}>
        <aside style={{ width: 340, background: "var(--surface)", padding: 24, overflowY: "auto", flexShrink: 0 }}>
          <section style={{ marginBottom: 28 }}>
            <h2 style={H2}>📤 上传图片</h2>
            <div onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processImage(f); }} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => fileInputRef.current?.click()} style={dropZone(dragOver)}>
              {imageData ? (
                <div>
                  <canvas ref={(ref) => { if (ref && imageData) { ref.width = imageData.width; ref.height = imageData.height; ref.getContext("2d")!.putImageData(imageData, 0, 0); } }} style={{ maxWidth: "100%", borderRadius: 8, imageRendering: "pixelated" }} />
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-dim)" }}>{imgDimensions.w} x {imgDimensions.h} px</p>
                </div>
              ) : (
                <div><div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div><p style={{ margin: "4px 0", fontSize: 14 }}>点击或拖拽上传</p><p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim)" }}>JPG / PNG / WebP</p></div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) processImage(f); }} />
            </div>
          </section>
          <section style={{ marginBottom: 28 }}>
            <h2 style={H2}>⚙️ 打印参数</h2>
            <Slider label="打印宽度" value={params.targetWidth} min={20} max={200} step={5} unit="mm" onChange={(v) => setParams({ ...params, targetWidth: v })} />
            <Slider label="浮雕高度" value={params.maxHeight} min={0.5} max={10} step={0.5} unit="mm" onChange={(v) => setParams({ ...params, maxHeight: v })} />
            <Slider label="底座厚度" value={params.baseThickness} min={0.5} max={5} step={0.5} unit="mm" onChange={(v) => setParams({ ...params, baseThickness: v })} />
            <Slider label="平滑度" value={params.smoothPasses} min={0} max={8} step={1} unit={params.smoothPasses === 0 ? "(锐利)" : "次"} onChange={(v) => setParams({ ...params, smoothPasses: v })} />
            <Slider label="高度强度" value={params.zScale} min={0.3} max={2.0} step={0.1} unit="x" onChange={(v) => setParams({ ...params, zScale: v })} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <span style={{ fontSize: 14 }}>反转 (亮→凸)</span>
              <button onClick={() => { const ni = !params.invert; setParams({ ...params, invert: ni }); if (imageData) setHeightMap(imageDataToHeightMap(imageData, ni)); }} style={toggle(params.invert)}>
                <span style={{ position: "absolute", top: 3, left: params.invert ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>
          </section>
          {imageData && <div style={infoBox}><div>📐 {params.targetWidth} x {((params.targetWidth / imgDimensions.w) * imgDimensions.h).toFixed(0)} x {(params.baseThickness + params.maxHeight).toFixed(1)} mm</div>{stlSize && <div>📦 {stlSize}</div>}</div>}
          <button onClick={generateSTL} disabled={!imageData || generating} style={btn(!imageData || generating)}>{generating ? "⏳ 生成中..." : "⬇️ 下载 STL"}</button>
        </aside>
        <main style={{ flex: 1, background: "#0a0a0f", position: "relative" }}>
          {imageData && previewHeightMap ? <STLPreview heightMap={previewHeightMap} width={imageData.width} height={imageData.height} params={{ targetWidth: params.targetWidth, maxHeight: params.maxHeight, baseThickness: params.baseThickness, zScale: params.zScale, invert: params.invert }} /> : <Placeholder icon="🖨️" text="上传图片后显示 3D 浮雕预览" sub="拖拽旋转 · 滚轮缩放" />}
        </main>
      </div>
    </>
  );
}

// ============ AI Mode - 3 Step Pipeline ============
function AIMode() {
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [meshyKey, setMeshyKey] = useState("");
  const [step, setStep] = useState(1); // 1=upload, 2=design, 3=3d
  const [originalImage, setOriginalImage] = useState<string>("");
  const [designPrompt, setDesignPrompt] = useState("turn this into a 3D figurine collectible style, clean background");
  const [designing, setDesigning] = useState(false);
  const [designedImage, setDesignedImage] = useState<string>("");
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<boolean>(false);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { setOriginalImage(e.target?.result as string); setStep(2); setError(""); };
    reader.readAsDataURL(file);
  };

  // Step 2: AI design with Gemini
  const runDesign = async () => {
    if (!openrouterKey) { setError("请先输入 OpenRouter API Key"); return; }
    if (!originalImage) { setError("请先上传图片"); return; }
    setDesigning(true); setError(""); setDesignedImage(""); setStatus("AI 设计中...");
    try {
      const resp = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-openrouter-key": openrouterKey },
        body: JSON.stringify({ imageUrl: originalImage, prompt: designPrompt }),
      });
      const data = await resp.json();
      if (data.success && data.generatedImageUrl) {
        setDesignedImage(data.generatedImageUrl); setStep(3); setStatus("");
      } else {
        setError(data.error || "AI 生图失败，请检查 API Key");
      }
    } catch (err) { setError("网络错误: " + (err as Error).message); }
    setDesigning(false);
  };

  // Step 3: Convert to 3D with Meshy
  const convertTo3D = async () => {
    if (!meshyKey) { setError("请先输入 Meshy API Key"); return; }
    if (!designedImage) { setError("请先生成设计图"); return; }
    setConverting(true); setError(""); setModelUrl(null); setStatus("上传图片中..."); setProgress(5);
    try {
      // Upload to Meshy first
      const base64 = designedImage.includes(",") ? designedImage.split(",")[1] : designedImage;
      const upResp = await fetch("/api/meshy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-meshy-key": meshyKey },
        body: JSON.stringify({ action: "upload", imageData: base64 }),
      });
      const upData = await upResp.json();
      if (!upData.url) throw new Error(upData.error || "上传失败");
      setStatus("AI 转 3D 中..."); setProgress(15);
      // Create task
      const createResp = await fetch("/api/meshy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-meshy-key": meshyKey },
        body: JSON.stringify({ action: "image-to-3d", imageUrl: upData.url, shouldTexture: true, enablePbr: true }),
      });
      const createData = await createResp.json();
      if (!createData.taskId) throw new Error(createData.error || "创建任务失败");
      // Poll
      pollRef.current = true;
      for (let i = 0; i < 120 && pollRef.current; i++) {
        await new Promise(r => setTimeout(r, 3000));
        if (!pollRef.current) break;
        const pResp = await fetch("/api/meshy?taskId=" + createData.taskId + "&type=image", { headers: { "x-meshy-key": meshyKey } });
        const pData = await pResp.json();
        if (pData.status === "SUCCEEDED") { setModelUrl(pData.modelUrls?.glb || null); setStatus("✅ 完成!"); setProgress(100); break; }
        else if (pData.status === "FAILED") { throw new Error(pData.taskError?.message || "转换失败"); }
        else { setStatus("⏳ " + pData.status + "..."); setProgress(Math.min(pData.progress || 20, 95)); }
      }
    } catch (err) { setError((err as Error).message); }
    setConverting(false);
  };

  const downloadGLB = async () => {
    if (!modelUrl) return;
    const resp = await fetch(modelUrl); const blob = await resp.blob();
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "figuro_3d_" + Date.now() + ".glb"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex: 1, display: "flex", gap: 1, background: "var(--border)", minHeight: 0 }}>
      <aside style={{ width: 340, background: "var(--surface)", padding: 24, overflowY: "auto", flexShrink: 0 }}>
        {/* API Keys */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={H2}>🔑 API Keys</h2>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>OpenRouter (生图)</label>
          <input type="password" value={openrouterKey} onChange={(e) => setOpenrouterKey(e.target.value)} placeholder="sk-or-..." style={input} />
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style={{ fontSize: 11, color: "var(--accent)", display: "block", margin: "4px 0 12px" }}>→ 免费获取</a>
          <label style={{ fontSize: 12, color: "var(--text-dim)", display: "block", marginBottom: 4 }}>Meshy (转3D)</label>
          <input type="password" value={meshyKey} onChange={(e) => setMeshyKey(e.target.value)} placeholder="msy_..." style={input} />
          <a href="https://www.meshy.ai/settings/api" target="_blank" rel="noopener" style={{ fontSize: 11, color: "var(--accent)", display: "block", margin: "4px 0 0" }}>→ 免费获取 (100 credits/月)</a>
        </section>

        {/* Pipeline Steps */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, textAlign: "center", fontSize: 11, fontWeight: 600, background: step >= n ? "var(--accent)" : "var(--border)", color: step >= n ? "#fff" : "var(--text-dim)", opacity: step >= n ? 1 : 0.5 }}>
              {step > n ? "✓ " : ""}{["上传", "AI设计", "转3D"][n - 1]}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        <section style={{ marginBottom: 20, opacity: step < 1 ? 0.5 : 1 }}>
          <h2 style={H2}>① 上传原图</h2>
          <div onClick={() => fileInputRef.current?.click()} style={dropZone(false)}>
            {originalImage ? (
              <img src={originalImage} style={{ maxWidth: "100%", borderRadius: 8 }} />
            ) : (
              <div><div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div><p style={{ fontSize: 12 }}>点击上传</p></div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </section>

        {/* Step 2: AI Design */}
        {step >= 2 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={H2}>② AI 设计生图</h2>
            <textarea value={designPrompt} onChange={(e) => setDesignPrompt(e.target.value)} rows={2} style={{ ...input, resize: "vertical", marginBottom: 8 }} />
            <button onClick={runDesign} disabled={designing || !openrouterKey} style={btn(designing || !openrouterKey)}>{designing ? "⏳ " + (status || "生成中...") : "🎨 AI 设计"}</button>
            {designedImage && (
              <div style={{ marginTop: 8 }}>
                <img src={designedImage} style={{ maxWidth: "100%", borderRadius: 8 }} />
                <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", margin: "4px 0" }}>✅ 设计图已生成</p>
              </div>
            )}
          </section>
        )}

        {/* Step 3: Convert to 3D */}
        {step >= 3 && designedImage && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={H2}>③ AI 转 3D 模型</h2>
            <button onClick={convertTo3D} disabled={converting || !meshyKey} style={btn(converting || !meshyKey)}>{converting ? "⏳ " + (status || "转换中...") : "🤖 生成 3D 模型"}</button>
            {converting && progress > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg, #6366f1, #a855f7)", transition: "width 0.5s" }} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", margin: "4px 0" }}>{progress}%</p>
              </div>
            )}
            {modelUrl && <button onClick={downloadGLB} style={{ ...btn(false), marginTop: 8, background: "linear-gradient(135deg, #10b981, #34d399)" }}>⬇️ 下载 GLB 模型</button>}
          </section>
        )}

        {error && <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, color: "#fca5a5", marginBottom: 12 }}>❌ {error}</div>}

        <div style={infoBox}>
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>💰 成本</div>
          <div>• 生图 ~3 credits (OpenRouter)</div>
          <div>• 转3D ~30 credits (Meshy)</div>
          <div>• 免费额度够做 ~3 个/月</div>
        </div>
      </aside>

      <main style={{ flex: 1, background: "#0a0a0f", position: "relative" }}>
        {modelUrl ? <AIModelPreview modelUrl={modelUrl} /> : <Placeholder icon="🤖" text={converting ? status : designedImage ? "点击「生成 3D 模型」" : originalImage ? "点击「AI 设计」生成手办风格图" : "上传图片开始三步流水线"} sub={converting ? progress + "%" : "生图 → 设计图 → 3D模型"} />}
      </main>
    </div>
  );
}

// ============ Shared ============
const H2: React.CSSProperties = { fontSize: 13, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12, letterSpacing: 1 };
function dropZone(over: boolean): React.CSSProperties { return { border: "2px dashed " + (over ? "var(--accent)" : "var(--border)"), borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer", background: over ? "rgba(99,102,241,0.05)" : "transparent" }; }
function btn(disabled: boolean): React.CSSProperties { return { width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: disabled ? "var(--border)" : "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }; }
const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, outline: "none" };
function toggle(active: boolean): React.CSSProperties { return { width: 44, height: 24, borderRadius: 12, border: "none", background: active ? "var(--accent)" : "var(--border)", cursor: "pointer", position: "relative" }; }
const infoBox: React.CSSProperties = { padding: 14, borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid var(--border)", marginBottom: 16, fontSize: 12, lineHeight: 1.8, color: "var(--text-dim)" };
function Placeholder({ icon, text, sub }: { icon: string; text: string; sub: string }) { return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div><p style={{ fontSize: 14 }}>{text}</p><p style={{ fontSize: 12, marginTop: 8 }}>{sub}</p></div></div>; }
function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) { return <div style={{ marginBottom: 16 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}><span>{label}</span><span style={{ color: "var(--accent)", fontWeight: 600 }}>{value}{unit && !unit.startsWith("(") ? " " + unit : ""}{unit.startsWith("(") ? " " + unit : ""}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} /></div>; }

