"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import STLPreview from "@/components/STLPreview";
import AIModelPreview from "@/components/AIModelPreview";
import {
  imageDataToHeightMap,
  imageDataToSTL,
  smoothHeightMap,
  DEFAULT_PARAMS,
  type ReliefParams,
} from "@/lib/stl-engine";

type Mode = "relief" | "ai";

export default function Home() {
  const [mode, setMode] = useState<Mode>("relief");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          🎨
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Figuro</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>
            2D图片 → 3D模型 → STL打印
          </p>
        </div>

        {/* 模式切换 */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "var(--surface)",
            borderRadius: 10,
            padding: 4,
            border: "1px solid var(--border)",
          }}
        >
          <ModeButton
            active={mode === "relief"}
            onClick={() => setMode("relief")}
            icon="🏔️"
            label="浮雕"
          />
          <ModeButton
            active={mode === "ai"}
            onClick={() => setMode("ai")}
            icon="🤖"
            label="AI转3D"
          />
        </div>
      </header>

      {mode === "relief" ? <ReliefMode /> : <AIMode />}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text-dim)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ============ 浮雕模式（原有功能）============

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

  const processImage = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("请上传图片文件 (JPG/PNG/WebP)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 200;
          let w = img.width;
          let h = img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            const scale = MAX_DIM / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = canvasRef.current!;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          setImageData(data);
          setImgDimensions({ w, h });
          const hm = imageDataToHeightMap(data, params.invert);
          setHeightMap(hm);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [params.invert]
  );

  useEffect(() => {
    if (!heightMap || !imageData) return;
    const smoothed = smoothHeightMap(heightMap, imageData.width, imageData.height, params.smoothPasses);
    setPreviewHeightMap(smoothed);
  }, [heightMap, imageData, params.smoothPasses]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  const generateSTL = useCallback(() => {
    if (!imageData) return;
    setGenerating(true);
    setTimeout(() => {
      try {
        const stl = imageDataToSTL(imageData, params);
        const blob = new Blob([stl], { type: "model/stl" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `figuro_relief_${Date.now()}.stl`;
        a.click();
        URL.revokeObjectURL(url);
        setStlSize(blob.size > 1048576 ? `${(blob.size / 1048576).toFixed(1)} MB` : `${(blob.size / 1024).toFixed(1)} KB`);
      } catch (err) {
        alert("生成失败: " + (err as Error).message);
      }
      setGenerating(false);
    }, 50);
  }, [imageData, params]);

  const previewParams = {
    targetWidth: params.targetWidth,
    maxHeight: params.maxHeight,
    baseThickness: params.baseThickness,
    zScale: params.zScale,
    invert: params.invert,
  };

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ flex: 1, display: "flex", gap: 1, background: "var(--border)", minHeight: 0 }}>
        <aside style={{ width: 340, background: "var(--surface)", padding: 24, overflowY: "auto", flexShrink: 0 }}>
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHeader}>📤 上传图片</h2>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={dropZoneStyle(dragOver)}
            >
              {imageData ? (
                <div>
                  <canvas
                    ref={(ref) => { if (ref && imageData) { ref.width = imageData.width; ref.height = imageData.height; ref.getContext("2d")!.putImageData(imageData, 0, 0); } }}
                    style={{ maxWidth: "100%", borderRadius: 8, imageRendering: "pixelated" }}
                  />
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                    {imgDimensions.w} × {imgDimensions.h} px · 点击更换
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                  <p style={{ margin: "4px 0", fontSize: 14 }}>点击或拖拽上传</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim)" }}>JPG / PNG / WebP</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) processImage(f); }} />
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHeader}>⚙️ 打印参数</h2>
            <Slider label="打印宽度" value={params.targetWidth} min={20} max={200} step={5} unit="mm" onChange={(v) => setParams({ ...params, targetWidth: v })} />
            <Slider label="浮雕高度" value={params.maxHeight} min={0.5} max={10} step={0.5} unit="mm" onChange={(v) => setParams({ ...params, maxHeight: v })} />
            <Slider label="底座厚度" value={params.baseThickness} min={0.5} max={5} step={0.5} unit="mm" onChange={(v) => setParams({ ...params, baseThickness: v })} />
            <Slider label="平滑度" value={params.smoothPasses} min={0} max={8} step={1} unit={params.smoothPasses === 0 ? "(锐利)" : "次"} onChange={(v) => setParams({ ...params, smoothPasses: v })} />
            <Slider label="高度强度" value={params.zScale} min={0.3} max={2.0} step={0.1} unit="x" onChange={(v) => setParams({ ...params, zScale: v })} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <span style={{ fontSize: 14 }}>反转 (亮→凸)</span>
              <button
                onClick={() => { const ni = !params.invert; setParams({ ...params, invert: ni }); if (imageData) { setHeightMap(imageDataToHeightMap(imageData, ni)); } }}
                style={toggleStyle(params.invert)}
              >
                <span style={{ position: "absolute", top: 3, left: params.invert ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>
          </section>

          {imageData && (
            <div style={infoBox}>
              <div>📐 模型尺寸: <span style={{ color: "var(--text)" }}>{params.targetWidth} × {((params.targetWidth / imgDimensions.w) * imgDimensions.h).toFixed(0)} × {(params.baseThickness + params.maxHeight).toFixed(1)} mm</span></div>
              {stlSize && <div>📦 文件大小: <span style={{ color: "var(--text)" }}>{stlSize}</span></div>}
            </div>
          )}

          <button onClick={generateSTL} disabled={!imageData || generating} style={primaryButton(!imageData || generating)}>
            {generating ? "⏳ 生成中..." : "⬇️ 下载 STL 文件"}
          </button>
        </aside>

        <main style={{ flex: 1, background: "#0a0a0f", position: "relative" }}>
          {imageData && previewHeightMap ? (
            <STLPreview heightMap={previewHeightMap} width={imageData.width} height={imageData.height} params={previewParams} />
          ) : (
            <PlaceholderView icon="🖨️" text="上传图片后，这里会显示 3D 浮雕预览" sub="鼠标拖拽旋转 · 滚轮缩放" />
          )}
        </main>
      </div>
    </>
  );
}

// ============ AI 转 3D 模式 ============

function AIMode() {
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [inputType, setInputType] = useState<"image" | "text">("image");
  const [textPrompt, setTextPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<boolean>(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  // 轮询任务状态
  const pollTask = useCallback(async (taskId: string, type: "image" | "text", key: string) => {
    pollRef.current = true;
    let attempts = 0;
    while (pollRef.current && attempts < 120) {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      if (!pollRef.current) break;

      try {
        const resp = await fetch(`/api/meshy?taskId=${taskId}&type=${type}`, {
          headers: { "x-meshy-key": key },
        });
        const data = await resp.json();

        if (data.status === "SUCCEEDED") {
          const glbUrl = data.modelUrls?.glb;
          if (glbUrl) {
            setModelUrl(glbUrl);
            setStatus("✅ 生成完成！");
            setProgress(100);
          } else {
            setStatus("✅ 完成，但未获取到模型 URL");
          }
          break;
        } else if (data.status === "FAILED") {
          setError(data.taskError?.message || "生成失败");
          setStatus("");
          break;
        } else {
          setStatus(`⏳ ${data.status}...`);
          setProgress(Math.min(data.progress || 10, 95));
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }
    setGenerating(false);
  }, []);

  const generate = useCallback(async () => {
    setError("");
    setModelUrl(null);

    if (!apiKey) {
      setError("请先输入 Meshy API Key");
      return;
    }

    if (inputType === "image" && !file) {
      setError("请先上传一张图片");
      return;
    }

    if (inputType === "text" && !textPrompt.trim()) {
      setError("请输入描述文字");
      return;
    }

    setGenerating(true);
    setStatus("📤 上传中...");
    setProgress(5);

    try {
      if (inputType === "image") {
        // Step 1: 上传图片到 Meshy
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            // 去掉 data:image/xxx;base64, 前缀
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(file!);
        });

        const uploadResp = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-meshy-key": apiKey },
          body: JSON.stringify({ action: "upload", imageData: base64 }),
        });
        const uploadData = await uploadResp.json();

        if (!uploadData.url) {
          throw new Error(uploadData.error || "图片上传失败");
        }

        setStatus("🤖 AI 生成中（约30-60秒）...");
        setProgress(15);

        // Step 2: 创建 Image to 3D 任务
        const createResp = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-meshy-key": apiKey },
          body: JSON.stringify({
            action: "image-to-3d",
            imageUrl: uploadData.url,
            shouldTexture: true,
            enablePbr: true,
          }),
        });
        const createData = await createResp.json();

        if (!createData.taskId) {
          throw new Error(createData.error || "创建任务失败");
        }

        // Step 3: 轮询
        await pollTask(createData.taskId, "image", apiKey);
      } else {
        // Text to 3D
        setStatus("🤖 AI 生成中...");
        setProgress(15);

        const createResp = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-meshy-key": apiKey },
          body: JSON.stringify({
            action: "text-to-3d",
            prompt: textPrompt,
          }),
        });
        const createData = await createResp.json();

        if (!createData.taskId) {
          throw new Error(createData.error || "创建任务失败");
        }

        await pollTask(createData.taskId, "text", apiKey);
      }
    } catch (err) {
      setError((err as Error).message);
      setStatus("");
      setGenerating(false);
    }
  }, [apiKey, file, inputType, textPrompt, pollTask]);

  // 下载 GLB
  const downloadModel = useCallback(async () => {
    if (!modelUrl) return;
    const resp = await fetch(modelUrl);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `figuro_ai_${Date.now()}.glb`;
    a.click();
    URL.revokeObjectURL(url);
  }, [modelUrl]);

  return (
    <div style={{ flex: 1, display: "flex", gap: 1, background: "var(--border)", minHeight: 0 }}>
      <aside style={{ width: 340, background: "var(--surface)", padding: 24, overflowY: "auto", flexShrink: 0 }}>
        {/* API Key 输入 */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionHeader}>🔑 Meshy API Key</h2>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="msy_xxxxx"
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "6px 0 0", lineHeight: 1.5 }}>
            免费100次/月：
            <a href="https://www.meshy.ai/settings/api" target="_blank" rel="noopener" style={{ color: "var(--accent)", textDecoration: "none" }}>
              → 点此获取 Key
            </a>
          </p>
        </section>

        {/* 输入类型切换 */}
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setInputType("image")} style={subTabStyle(inputType === "image")}>📷 图片</button>
            <button onClick={() => setInputType("text")} style={subTabStyle(inputType === "text")}>✏️ 文字</button>
          </div>
        </section>

        {/* 图片上传 */}
        {inputType === "image" && (
          <section style={{ marginBottom: 24 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={dropZoneStyle(false)}
            >
              {filePreview ? (
                <img src={filePreview} style={{ maxWidth: "100%", borderRadius: 8 }} />
              ) : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                  <p style={{ fontSize: 13 }}>上传手办/模型图片</p>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>AI 会自动生成 3D 立体模型</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </section>
        )}

        {/* 文字输入 */}
        {inputType === "text" && (
          <section style={{ marginBottom: 24 }}>
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="例如: a cute cartoon cat figurine, standing pose"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
          </section>
        )}

        {/* 生成按钮 */}
        <button onClick={generate} disabled={generating} style={primaryButton(generating)}>
          {generating ? `⏳ ${status || "生成中..."}` : "🤖 AI 生成 3D 模型"}
        </button>

        {/* 进度条 */}
        {generating && progress > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #6366f1, #a855f7)", transition: "width 0.5s" }} />
            </div>
            <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", margin: "6px 0 0" }}>
              {progress}%
            </p>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 12, color: "#fca5a5" }}>
            ❌ {error}
          </div>
        )}

        {/* 下载 */}
        {modelUrl && (
          <button onClick={downloadModel} style={{ ...primaryButton(false), marginTop: 12, background: "linear-gradient(135deg, #10b981, #34d399)" }}>
            ⬇️ 下载 GLB 模型
          </button>
        )}

        {/* 说明 */}
        <div style={{ ...infoBox, marginTop: 16 }}>
          <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>💡 AI 转 3D 说明</div>
          <div>• 生成一次约消耗 30 credits</div>
          <div>• 免费额度 100次/月（约3个模型）</div>
          <div>• 输出 GLB 格式（含纹理颜色）</div>
          <div>• 可用 Blender 等软件转 STL 打印</div>
        </div>
      </aside>

      {/* 3D 预览 */}
      <main style={{ flex: 1, background: "#0a0a0f", position: "relative" }}>
        {modelUrl ? (
          <AIModelPreview modelUrl={modelUrl} />
        ) : (
          <PlaceholderView
            icon="🤖"
            text={generating ? status : "上传图片，AI 自动生成 3D 立体模型"}
            sub={generating ? `进度 ${progress}%` : "需要 Meshy API Key（免费注册）"}
          />
        )}
      </main>
    </div>
  );
}

// ============ 共用样式 & 组件 ============

const sectionHeader: React.CSSProperties = {
  fontSize: 13,
  textTransform: "uppercase",
  color: "var(--text-dim)",
  marginBottom: 12,
  letterSpacing: 1,
};

function dropZoneStyle(dragOver: boolean): React.CSSProperties {
  return {
    border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 12,
    padding: "32px 16px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    background: dragOver ? "rgba(99,102,241,0.05)" : "transparent",
  };
}

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    background: disabled
      ? "var(--border)"
      : "linear-gradient(135deg, #6366f1, #a855f7)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s",
  };
}

const infoBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: "rgba(99,102,241,0.06)",
  border: "1px solid var(--border)",
  marginBottom: 20,
  fontSize: 12,
  lineHeight: 1.8,
  color: "var(--text-dim)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

function subTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 0",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--text-dim)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  };
}

function toggleStyle(active: boolean): React.CSSProperties {
  return {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: "none",
    background: active ? "var(--accent)" : "var(--border)",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.2s",
  };
}

function PlaceholderView({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
        <p style={{ fontSize: 14 }}>{text}</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>{sub}</p>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
        <span>{label}</span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          {value}{unit && !unit.startsWith("(") ? ` ${unit}` : ""}{unit.startsWith("(") ? ` ${unit}` : ""}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}
