"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import STLPreview from "@/components/STLPreview";
import AIModelPreview from "@/components/AIModelPreview";
import { imageDataToHeightMap, imageDataToSTL, smoothHeightMap, DEFAULT_PARAMS, type ReliefParams } from "@/lib/stl-engine";

type Mode = "relief" | "ai";

export default function Home() {
  const [mode, setMode] = useState<Mode>("relief");
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎨</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Figuro</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>2D image to 3D model to STL print</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          <button onClick={() => setMode("relief")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: mode === "relief" ? "var(--accent)" : "transparent", color: mode === "relief" ? "#fff" : "var(--text-dim)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🏔️ 浮雕</button>
          <button onClick={() => setMode("ai")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: mode === "ai" ? "var(--accent)" : "transparent", color: mode === "ai" ? "#fff" : "var(--text-dim)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🤖 AI转3D</button>
        </div>
      </header>
      {mode === "relief" ? <ReliefMode /> : <AIMode />}
    </div>
  );
}

function ReliefMode() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [heightMap, setHeightMap] = useState<Float32Array | null>(null);
  const [previewHeightMap, setPreviewHeightMap] = useState<Float32Array | null>(null);
  const [params, setParams] = useState<ReliefParams>(DEFAULT_PARAMS);
  const [generating, setGenerating] = useState(false);
  const [stlSize, setStlSize] = useState("");
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 200; let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) { const s = MAX_DIM / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const canvas = canvasRef.current!; canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const data = canvas.getContext("2d")!.getImageData(0, 0, w, h);
        setImageData(data); setImgDimensions({ w, h });
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

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ flex: 1, display: "flex", gap: 1, background: "var(--border)", minHeight: 0 }}>
        <aside style={{ width: 340, background: "var(--surface)", padding: 24, overflowY: "auto", flexShrink: 0 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12, letterSpacing: 1 }}>📤 上传图片</h2>
          <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer" }}>
            {imageData ? (
              <div>
                <canvas ref={(ref) => { if (ref && imageData) { ref.width = imageData.width; ref.height = imageData.height; ref.getContext("2d")!.putImageData(imageData, 0, 0); } }} style={{ maxWidth: "100%", borderRadius: 8, imageRendering: "pixelated" }} />
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-dim)" }}>{imgDimensions.w}x{imgDimensions.h}px</p>
              </div>
            ) : <div><div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div><p style={{ fontSize: 14 }}>点击或拖拽上传</p><p style={{ fontSize: 11, color: "var(--text-dim)" }}>JPG / PNG / WebP</p></div>}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) processImage(f); }} />
          </div>
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12, letterSpacing: 1 }}>⚙️ 打印参数</h2>
            {[
              { l: "打印宽度", v: params.targetWidth, min: 20, max: 200, step: 5, u: "mm", set: (v: number) => setParams({ ...params, targetWidth: v }) },
              { l: "浮雕高度", v: params.maxHeight, min: 0.5, max: 10, step: 0.5, u: "mm", set: (v: number) => setParams({ ...params, maxHeight: v }) },
              { l: "底座厚度", v: params.baseThickness, min: 0.5, max: 5, step: 0.5, u: "mm", set: (v: number) => setParams({ ...params, baseThickness: v }) },
              { l: "平滑度", v: params.smoothPasses, min: 0, max: 8, step: 1, u: params.smoothPasses === 0 ? "(锐利)" : "次", set: (v: number) => setParams({ ...params, smoothPasses: v }) },
              { l: "高度强度", v: params.zScale, min: 0.3, max: 2.0, step: 0.1, u: "x", set: (v: number) => setParams({ ...params, zScale: v }) },
            ].map((s) => (
              <div key={s.l} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span>{s.l}</span><span style={{ color: "var(--accent)", fontWeight: 600 }}>{s.v} {s.u}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.v} onChange={(e) => s.set(parseFloat(e.target.value))} />
              </div>
            ))}
          </div>
          <button onClick={() => {
            if (!imageData) return; setGenerating(true);
            setTimeout(() => {
              const stl = imageDataToSTL(imageData, params);
              const blob = new Blob([stl], { type: "model/stl" });
              const url = URL.createObjectURL(blob); const a = document.createElement("a");
              a.href = url; a.download = "figuro_relief.stl"; a.click(); URL.revokeObjectURL(url);
              setStlSize((blob.size / 1024).toFixed(0) + " KB"); setGenerating(false);
            }, 50);
          }} disabled={!imageData || generating} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: !imageData || generating ? "var(--border)" : "linear-gradient(135deg, #6366f1, #a855f7)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: !imageData || generating ? "not-allowed" : "pointer", marginTop: 20 }}>
            {generating ? "⏳ 生成中..." : "⬇️ 下载 STL"}
          </button>
        </aside>
        <main style={{ flex: 1, background: "#0a0a0f" }}>
          {imageData && previewHeightMap ? <STLPreview heightMap={previewHeightMap} width={imageData.width} height={imageData.height} params={{ targetWidth: params.targetWidth, maxHeight: params.maxHeight, baseThickness: params.baseThickness, zScale: params.zScale, invert: params.invert }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🖨️</div><p>上传图片后显示 3D 浮雕预览</p></div></div>}
        </main>
      </div>
    </>
  );
}

function AIMode() {
  const [falKey, setFalKey] = useState("");
  const [step, setStep] = useState(1);
  const [originalImage, setOriginalImage] = useState("");
  const [originalBase64, setOriginalBase64] = useState("");
  const [designPrompt, setDesignPrompt] = useState("turn this into a 3D figurine collectible toy, clean white background");
  const [designing, setDesigning] = useState(false);
  const [designedImage, setDesignedImage] = useState("");
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setOriginalImage(dataUrl);
      setOriginalBase64(dataUrl.split(",")[1]);
      setStep(2); setError("");
    };
    reader.readAsDataURL(file);
  };

  // Step 2: Flux image generation
  const runDesign = async () => {
    if (!falKey) { setError("Need fal.ai API key first"); return; }
    if (!originalBase64) { setError("Upload an image first"); return; }
    setDesigning(true); setError(""); setStatus("Uploading image..."); setProgress(5);
    try {
      // Upload original image to fal storage
      const upResp = await fetch("/api/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fal-key": falKey },
        body: JSON.stringify({ action: "upload", imageData: originalBase64 }),
      });
      const upData = await upResp.json();
      if (!upData.url) throw new Error(upData.error || "Upload failed");
      setStatus("AI designing (Flux)..."); setProgress(20);

      // Submit Flux image-to-image task
      const genResp = await fetch("/api/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fal-key": falKey },
        body: JSON.stringify({ action: "generate-image", prompt: designPrompt, imageUrl: upData.url }),
      });
      const genData = await genResp.json();
      if (!genData.requestId) throw new Error(genData.error || "Image generation failed");
      setStatus("Generating design..."); setProgress(40);

      // Poll for result
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const pResp = await fetch("/api/fal?requestId=" + genData.requestId + "&model=fal-ai/flux/dev", { headers: { "x-fal-key": falKey } });
        const pData = await pResp.json();
        if (pData.status === "COMPLETED" && pData.imageUrl) {
          setDesignedImage(pData.imageUrl); setStep(3); setStatus(""); setProgress(0);
          return;
        }
        if (pData.status === "FAILED" || pData.status === "ERROR") throw new Error("Image generation failed");
        setProgress(Math.min(40 + i * 2, 90));
        setStatus("Generating... " + (40 + i * 2) + "%");
      }
      throw new Error("Timeout");
    } catch (err) { setError((err as Error).message); }
    setDesigning(false);
  };

  // Step 3: Convert to 3D with Trellis
  const convertTo3D = async () => {
    if (!falKey) { setError("Need fal.ai API key"); return; }
    if (!designedImage) { setError("Generate design image first"); return; }
    setConverting(true); setError(""); setModelUrl(null); setStatus("Uploading design..."); setProgress(5);
    try {
      // Download designed image and re-upload to fal storage
      const imgResp = await fetch(designedImage);
      const imgBlob = await imgResp.blob();
      const reader = new FileReader();
      const b64 = await new Promise<string>((resolve) => { reader.onload = () => resolve((reader.result as string).split(",")[1]); reader.readAsDataURL(imgBlob); });

      const upResp = await fetch("/api/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fal-key": falKey },
        body: JSON.stringify({ action: "upload", imageData: b64 }),
      });
      const upData = await upResp.json();
      if (!upData.url) throw new Error(upData.error || "Upload failed");
      setStatus("Converting to 3D (Trellis)..."); setProgress(15);

      const genResp = await fetch("/api/fal", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fal-key": falKey },
        body: JSON.stringify({ action: "generate-3d", imageUrl: upData.url }),
      });
      const genData = await genResp.json();
      if (!genData.requestId) throw new Error(genData.error || "3D generation failed");
      setStatus("AI 3D conversion..."); setProgress(20);

      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const pResp = await fetch("/api/fal?requestId=" + genData.requestId + "&model=fal-ai/trellis", { headers: { "x-fal-key": falKey } });
        const pData = await pResp.json();
        if (pData.status === "COMPLETED" && pData.modelUrl) {
          setModelUrl(pData.modelUrl); setStatus("Done!"); setProgress(100);
          return;
        }
        if (pData.status === "FAILED" || pData.status === "ERROR") throw new Error("3D conversion failed");
        setProgress(Math.min(20 + i * 2, 95));
        setStatus("Converting... " + Math.min(20 + i * 2, 95) + "%");
      }
      throw new Error("Timeout");
    } catch (err) { setError((err as Error).message); }
    setConverting(false);
  };

  const downloadGLB = async () => {
    if (!modelUrl) return;
    const resp = await fetch(modelUrl); const blob = await resp.blob();
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "figuro_3d.glb"; a.click(); URL.revokeObjectURL(url);
  };

  const H2 = { fontSize: 13, textTransform: "uppercase" as const, color: "var(--text-dim)", marginBottom: 12, letterSpacing: 1 };
  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, outline: "none" };
  const btn = (disabled: boolean, bg?: string) => ({ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: disabled ? "var(--border)" : (bg || "linear-gradient(135deg, #6366f1, #a855f7)"), color: "#fff", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" });

  return (
    <div style={{ flex: 1, display: "flex", gap: 1, background: "var(--border)", minHeight: 0 }}>
      <aside style={{ width: 340, background: "var(--surface)", padding: 24, overflowY: "auto", flexShrink: 0 }}>
        {/* API Key */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={H2}>🔑 fal.ai API Key</h2>
          <input type="password" value={falKey} onChange={(e) => setFalKey(e.target.value)} placeholder="fal-xxxx..." style={inputStyle} />
          <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener" style={{ fontSize: 11, color: "var(--accent)", display: "block", margin: "6px 0 0" }}>→ 注册送 (约43个模型)</a>
        </section>

        {/* Steps indicator */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, textAlign: "center", fontSize: 11, fontWeight: 600, background: step >= n ? "var(--accent)" : "var(--border)", color: step >= n ? "#fff" : "var(--text-dim)", opacity: step >= n ? 1 : 0.5 }}>
              {step > n ? "✓ " : ""}{["Upload", "AI Design", "3D Model"][n - 1]}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        <section style={{ marginBottom: 20 }}>
          <h2 style={H2}>① Upload Original</h2>
          <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "20px 12px", textAlign: "center", cursor: "pointer" }}>
            {originalImage ? <img src={originalImage} style={{ maxWidth: "100%", borderRadius: 8 }} /> : <div><div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div><p style={{ fontSize: 12 }}>Click to upload</p></div>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </section>

        {/* Step 2: AI Design */}
        {step >= 2 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={H2}>② AI Design (Flux)</h2>
            <textarea value={designPrompt} onChange={(e) => setDesignPrompt(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }} />
            <button onClick={runDesign} disabled={designing || !falKey} style={btn(designing || !falKey)}>{designing ? "⏳ " + (status || progress + "%") : "🎨 AI Design"}</button>
            {(designing || progress > 0) && (
              <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg, #6366f1, #a855f7)", transition: "width 0.5s" }} />
              </div>
            )}
            {designedImage && <div style={{ marginTop: 8 }}><img src={designedImage} style={{ maxWidth: "100%", borderRadius: 8 }} /><p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", margin: "4px 0" }}>✅ Design ready</p></div>}
          </section>
        )}

        {/* Step 3: Convert to 3D */}
        {step >= 3 && designedImage && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={H2}>③ Convert to 3D (Trellis)</h2>
            <button onClick={convertTo3D} disabled={converting || !falKey} style={btn(converting || !falKey)}>{converting ? "⏳ " + (status || progress + "%") : "🤖 Generate 3D"}</button>
            {(converting || progress > 0) && (
              <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg, #6366f1, #a855f7)", transition: "width 0.5s" }} />
              </div>
            )}
            {modelUrl && <button onClick={downloadGLB} style={{ ...btn(false, "linear-gradient(135deg, #10b981, #34d399)"), marginTop: 8 }}>⬇️ Download GLB</button>}
          </section>
        )}

        {error && <div style={{ padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, color: "#fca5a5", marginBottom: 12 }}>❌ {error}</div>}

        <div style={{ padding: 14, borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid var(--border)", fontSize: 12, lineHeight: 1.8, color: "var(--text-dim)" }}>
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>💰 Cost</div>
          <div>• Design: ~bash.003 (Flux)</div>
          <div>• 3D: ~bash.02 (Trellis)</div>
          <div>• Total: ~bash.023 (~0.16 RMB)</div>
          <div>•  free = ~43 models</div>
        </div>
      </aside>

      <main style={{ flex: 1, background: "#0a0a0f" }}>
        {modelUrl ? <AIModelPreview modelUrl={modelUrl} /> : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{converting || designing ? "⏳" : "🤖"}</div>
              <p style={{ fontSize: 14 }}>{converting || designing ? status || "Processing..." : designedImage ? "Click Generate 3D" : originalImage ? "Click AI Design" : "Upload image to start"}</p>
              {(converting || designing) && <p style={{ fontSize: 12, marginTop: 8 }}>{progress}%</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

