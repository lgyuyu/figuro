"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import STLPreview from "@/components/STLPreview";
import {
  imageDataToHeightMap,
  imageDataToSTL,
  smoothHeightMap,
  DEFAULT_PARAMS,
  type ReliefParams,
} from "@/lib/stl-engine";

export default function Home() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [heightMap, setHeightMap] = useState<Float32Array | null>(null);
  const [previewHeightMap, setPreviewHeightMap] = useState<Float32Array | null>(null);
  const [params, setParams] = useState<ReliefParams>(DEFAULT_PARAMS);
  const [generating, setGenerating] = useState(false);
  const [stlSize, setStlSize] = useState<string>("");
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理图片文件
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
          // 限制最大像素宽度，避免太大
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

          // 计算初始高度图
          const hm = imageDataToHeightMap(data, params.invert);
          setHeightMap(hm);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [params.invert]
  );

  // 参数变化时更新预览高度图
  useEffect(() => {
    if (!heightMap || !imageData) return;
    const smoothed = smoothHeightMap(
      heightMap,
      imageData.width,
      imageData.height,
      params.smoothPasses
    );
    setPreviewHeightMap(smoothed);
  }, [heightMap, imageData, params.smoothPasses]);

  // 拖拽处理
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processImage(file);
    },
    [processImage]
  );

  // 生成 STL 并下载
  const generateSTL = useCallback(() => {
    if (!imageData) return;
    setGenerating(true);

    // 用 setTimeout 让 UI 更新
    setTimeout(() => {
      try {
        const stl = imageDataToSTL(imageData, params);
        const blob = new Blob([stl], { type: "model/stl" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `figuro_${Date.now()}.stl`;
        a.click();
        URL.revokeObjectURL(url);

        const sizeKB = (blob.size / 1024).toFixed(1);
        const sizeStr =
          blob.size > 1024 * 1024
            ? `${(blob.size / (1024 * 1024)).toFixed(1)} MB`
            : `${sizeKB} KB`;
        setStlSize(sizeStr);
      } catch (err) {
        alert("生成失败: " + (err as Error).message);
      }
      setGenerating(false);
    }, 50);
  }, [imageData, params]);

  // 预览参数（传给3D组件）
  const previewParams = {
    targetWidth: params.targetWidth,
    maxHeight: params.maxHeight,
    baseThickness: params.baseThickness,
    zScale: params.zScale,
    invert: params.invert,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 顶部标题栏 */}
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
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Figuro</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-dim)" }}>
            图片 → 3D 浮雕 → STL 打印文件
          </p>
        </div>
      </header>

      {/* 隐藏的 canvas 用于图片处理 */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 主体布局 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 1,
          background: "var(--border)",
          minHeight: 0,
        }}
      >
        {/* 左侧控制面板 */}
        <aside
          style={{
            width: 340,
            background: "var(--surface)",
            padding: 24,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          {/* 上传区域 */}
          <section style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 12,
                letterSpacing: 1,
              }}
            >
              📤 上传图片
            </h2>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 12,
                padding: "32px 16px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                background: dragOver ? "rgba(99,102,241,0.05)" : "transparent",
              }}
            >
              {imageData ? (
                <div>
                  <canvas
                    ref={(ref) => {
                      if (ref && imageData) {
                        ref.width = imageData.width;
                        ref.height = imageData.height;
                        ref.getContext("2d")!.putImageData(imageData, 0, 0);
                      }
                    }}
                    style={{
                      maxWidth: "100%",
                      borderRadius: 8,
                      imageRendering: "pixelated",
                    }}
                  />
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: "var(--text-dim)",
                    }}
                  >
                    {imgDimensions.w} × {imgDimensions.h} px · 点击更换
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    🖼️
                  </div>
                  <p
                    style={{
                      margin: "4px 0",
                      fontSize: 14,
                      color: "var(--text)",
                    }}
                  >
                    点击或拖拽上传
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 11,
                      color: "var(--text-dim)",
                    }}
                  >
                    JPG / PNG / WebP
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processImage(file);
                }}
              />
            </div>
          </section>

          {/* 打印参数 */}
          <section style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 16,
                letterSpacing: 1,
              }}
            >
              ⚙️ 打印参数
            </h2>

            <Slider
              label="打印宽度"
              value={params.targetWidth}
              min={20}
              max={200}
              step={5}
              unit="mm"
              onChange={(v) => setParams({ ...params, targetWidth: v })}
            />
            <Slider
              label="浮雕高度"
              value={params.maxHeight}
              min={0.5}
              max={10}
              step={0.5}
              unit="mm"
              onChange={(v) => setParams({ ...params, maxHeight: v })}
            />
            <Slider
              label="底座厚度"
              value={params.baseThickness}
              min={0.5}
              max={5}
              step={0.5}
              unit="mm"
              onChange={(v) => setParams({ ...params, baseThickness: v })}
            />
            <Slider
              label="平滑度"
              value={params.smoothPasses}
              min={0}
              max={8}
              step={1}
              unit={params.smoothPasses === 0 ? "(锐利)" : "次"}
              onChange={(v) => setParams({ ...params, smoothPasses: v })}
            />
            <Slider
              label="高度强度"
              value={params.zScale}
              min={0.3}
              max={2.0}
              step={0.1}
              unit="x"
              onChange={(v) => setParams({ ...params, zScale: v })}
            />

            {/* 反转开关 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
              }}
            >
              <span style={{ fontSize: 14 }}>反转 (亮→凸)</span>
              <button
                onClick={() => {
                  const newInvert = !params.invert;
                  setParams({ ...params, invert: newInvert });
                  if (imageData) {
                    const hm = imageDataToHeightMap(imageData, newInvert);
                    setHeightMap(hm);
                  }
                }}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: "none",
                  background: params.invert
                    ? "var(--accent)"
                    : "var(--border)",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: params.invert ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          </section>

          {/* 打印信息 */}
          {imageData && (
            <section
              style={{
                padding: 16,
                borderRadius: 12,
                background: "rgba(99,102,241,0.06)",
                border: "1px solid var(--border)",
                marginBottom: 20,
                fontSize: 12,
                lineHeight: 1.8,
                color: "var(--text-dim)",
              }}
            >
              <div>
                📐 模型尺寸:{" "}
                <span style={{ color: "var(--text)" }}>
                  {params.targetWidth} ×{" "}
                  {(
                    (params.targetWidth / imgDimensions.w) *
                    imgDimensions.h
                  ).toFixed(0)}{" "}
                  × {(params.baseThickness + params.maxHeight).toFixed(1)} mm
                </span>
              </div>
              {stlSize && (
                <div>
                  📦 文件大小:{" "}
                  <span style={{ color: "var(--text)" }}>{stlSize}</span>
                </div>
              )}
            </section>
          )}

          {/* 生成按钮 */}
          <button
            onClick={generateSTL}
            disabled={!imageData || generating}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background:
                !imageData || generating
                  ? "var(--border)"
                  : "linear-gradient(135deg, #6366f1, #a855f7)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: !imageData || generating ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {generating ? "⏳ 生成中..." : "⬇️ 下载 STL 文件"}
          </button>
        </aside>

        {/* 右侧 3D 预览 */}
        <main style={{ flex: 1, background: "#0a0a0f", position: "relative" }}>
          {imageData && previewHeightMap ? (
            <STLPreview
              heightMap={previewHeightMap}
              width={imageData.width}
              height={imageData.height}
              params={previewParams}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-dim)",
                fontSize: 14,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🖨️</div>
                <p>上传图片后，这里会显示 3D 浮雕预览</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>
                  鼠标拖拽旋转 · 滚轮缩放
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** 滑块控件 */
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: 13,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          {value}
          {unit && !unit.startsWith("(") ? ` ${unit}` : ""}
          {unit.startsWith("(") ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
