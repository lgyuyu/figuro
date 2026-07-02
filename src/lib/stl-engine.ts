/**
 * STL 生成引擎 — 图片灰度 → 高度图 → STL 三角网格
 *
 * 核心原理（借鉴 Video-QRcode-Generator 的 make_qr_stl.py）：
 *   二维码项目：黑白矩阵 → 每个像素=一个方块 → 高度=黑/白 → STL
 *   本引擎：    任意灰度图 → 每个像素=一个顶点 → 高度=灰度值(0-255)→mm → STL
 *
 * 生成的是 ASCII STL 格式，兼容所有切片软件（Cura, PrusaSlicer, Bambu Studio）
 */

export interface ReliefParams {
  /** 打印目标宽度 mm */
  targetWidth: number;
  /** 最大浮雕高度 mm */
  maxHeight: number;
  /** 底座厚度 mm */
  baseThickness: number;
  /** 是否反转（暗=高 / 亮=高） */
  invert: boolean;
  /** 平滑次数 (0=原始锐利, 越大越平滑) */
  smoothPasses: number;
  /** 垂直缩放强度 0.1~2.0 */
  zScale: number;
}

export const DEFAULT_PARAMS: ReliefParams = {
  targetWidth: 80,
  maxHeight: 4,
  baseThickness: 1,
  invert: false,
  smoothPasses: 2,
  zScale: 1.0,
};

/**
 * 从 ImageData 提取灰度高度图
 * 返回 Float32Array，每个值 0.0~1.0 表示归一化高度
 */
export function imageDataToHeightMap(
  imageData: ImageData,
  invert: boolean
): Float32Array {
  const { data, width, height } = imageData;
  const heights = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3] / 255;

    // 标准灰度公式
    let gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // 考虑透明度：透明区域 = 0 高度
    gray *= a;

    if (invert) gray = 1.0 - gray;

    heights[i] = gray;
  }

  return heights;
}

/**
 * 高斯模糊平滑（让浮雕更自然，不像二维码那么棱角分明）
 */
export function smoothHeightMap(
  heights: Float32Array,
  width: number,
  height: number,
  passes: number
): Float32Array {
  if (passes <= 0) return heights;

  let current = heights;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        // 3x3 简单盒形模糊（近似高斯）
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += current[ny * width + nx];
              count++;
            }
          }
        }
        next[y * width + x] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

/**
 * 核心：高度图 → STL 三角网格
 *
 * 算法说明：
 *   - 每个像素 = 一个顶点，其 Z 高度 = 灰度值 × maxHeight
 *   - 相邻4个顶点构成2个三角形（一个四边形面片）
 *   - 顶面：所有网格的高度图
 *   - 底面：z=0 的平面
 *   - 侧面：四周边墙连接顶面和底面
 *
 * 生成 ASCII STL（文本格式，兼容性最好）
 */
export function heightMapToSTL(
  heights: Float32Array,
  width: number,
  height: number,
  params: ReliefParams
): string {
  const {
    targetWidth,
    maxHeight,
    baseThickness,
    smoothPasses,
    zScale,
  } = params;

  // 平滑处理
  const smoothed = smoothHeightMap(heights, width, height, smoothPasses);

  // 计算像素尺寸，缩放到目标宽度
  const pixelSize = targetWidth / width;
  const physicalWidth = targetWidth;
  const physicalHeight = pixelSize * height;

  // 计算每个顶点的 Z 高度
  const zValues = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    // 高度 = 底座 + 浮雕高度 × 灰度 × 缩放
    zValues[i] = baseThickness + smoothed[i] * maxHeight * zScale;
  }

  const lines: string[] = [];
  lines.push("solid relief");

  // === 1. 顶面（高度图网格）===
  // 每个格子由2个三角形组成
  //   (x,y)---(x+1,y)
  //    |         |
  //   (x,y+1)--(x+1,y+1)
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const x0 = x * pixelSize;
      const x1 = (x + 1) * pixelSize;
      const y0 = y * pixelSize;
      const y1 = (y + 1) * pixelSize;

      const z00 = zValues[y * width + x];
      const z10 = zValues[y * width + (x + 1)];
      const z01 = zValues[(y + 1) * width + x];
      const z11 = zValues[(y + 1) * width + (x + 1)];

      // 三角形 1: (x0,y0,z00) (x1,y0,z10) (x0,y1,z01)
      const n1 = computeNormal(
        [x0, y0, z00], [x1, y0, z10], [x0, y1, z01]
      );
      writeFacet(lines, n1, [x0, y0, z00], [x1, y0, z10], [x0, y1, z01]);

      // 三角形 2: (x1,y0,z10) (x1,y1,z11) (x0,y1,z01)
      const n2 = computeNormal(
        [x1, y0, z10], [x1, y1, z11], [x0, y1, z01]
      );
      writeFacet(lines, n2, [x1, y0, z10], [x1, y1, z11], [x0, y1, z01]);
    }
  }

  // === 2. 底面 (z=0, 法线朝下) ===
  const zBot = 0;
  // 两个三角形覆盖整个底面
  writeFacet(lines, [0, 0, -1],
    [0, 0, zBot], [0, physicalHeight, zBot], [physicalWidth, 0, zBot]);
  writeFacet(lines, [0, 0, -1],
    [physicalWidth, 0, zBot], [0, physicalHeight, zBot], [physicalWidth, physicalHeight, zBot]);

  // === 3. 侧面（四周边墙）===
  // 前边 y=0
  for (let x = 0; x < width - 1; x++) {
    const x0 = x * pixelSize;
    const x1 = (x + 1) * pixelSize;
    const z = zValues[x]; // y=0 行
    const zNext = zValues[x + 1];
    writeFacet(lines, [0, -1, 0],
      [x0, 0, zBot], [x1, 0, zBot], [x1, 0, zNext]);
    writeFacet(lines, [0, -1, 0],
      [x0, 0, zBot], [x1, 0, zNext], [x0, 0, z]);
  }
  // 后边 y=max
  for (let x = 0; x < width - 1; x++) {
    const x0 = x * pixelSize;
    const x1 = (x + 1) * pixelSize;
    const z = zValues[(height - 1) * width + x];
    const zNext = zValues[(height - 1) * width + x + 1];
    writeFacet(lines, [0, 1, 0],
      [x0, physicalHeight, zBot], [x1, physicalHeight, zNext], [x1, physicalHeight, zBot]);
    writeFacet(lines, [0, 1, 0],
      [x0, physicalHeight, zBot], [x0, physicalHeight, z], [x1, physicalHeight, zNext]);
  }
  // 左边 x=0
  for (let y = 0; y < height - 1; y++) {
    const y0 = y * pixelSize;
    const y1 = (y + 1) * pixelSize;
    const z = zValues[y * width];
    const zNext = zValues[(y + 1) * width];
    writeFacet(lines, [-1, 0, 0],
      [0, y0, zBot], [0, y1, zNext], [0, y1, zBot]);
    writeFacet(lines, [-1, 0, 0],
      [0, y0, zBot], [0, y0, z], [0, y1, zNext]);
  }
  // 右边 x=max
  for (let y = 0; y < height - 1; y++) {
    const y0 = y * pixelSize;
    const y1 = (y + 1) * pixelSize;
    const z = zValues[y * width + (width - 1)];
    const zNext = zValues[(y + 1) * width + (width - 1)];
    writeFacet(lines, [1, 0, 0],
      [physicalWidth, y0, zBot], [physicalWidth, y1, zBot], [physicalWidth, y1, zNext]);
    writeFacet(lines, [1, 0, 0],
      [physicalWidth, y0, zBot], [physicalWidth, y1, zNext], [physicalWidth, y0, z]);
  }

  lines.push("endsolid relief");

  return lines.join("\n");
}

/** 计算三角形面法线 */
function computeNormal(
  v1: number[], v2: number[], v3: number[]
): number[] {
  const ux = v2[0] - v1[0];
  const uy = v2[1] - v1[1];
  const uz = v2[2] - v1[2];
  const vx = v3[0] - v1[0];
  const vy = v3[1] - v1[1];
  const vz = v3[2] - v1[2];

  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

  return [nx / len, ny / len, nz / len];
}

/** 写一个 STL facet */
function writeFacet(
  lines: string[],
  normal: number[],
  v1: number[],
  v2: number[],
  v3: number[]
): void {
  lines.push(`facet normal ${f(normal[0])} ${f(normal[1])} ${f(normal[2])}`);
  lines.push("  outer loop");
  lines.push(`    vertex ${f(v1[0])} ${f(v1[1])} ${f(v1[2])}`);
  lines.push(`    vertex ${f(v2[0])} ${f(v2[1])} ${f(v2[2])}`);
  lines.push(`    vertex ${f(v3[0])} ${f(v3[1])} ${f(v3[2])}`);
  lines.push("  endloop");
  lines.push("endfacet");
}

function f(n: number): string {
  return n.toFixed(4);
}

/**
 * 主函数：图片 ImageData → STL 字符串
 */
export function imageDataToSTL(
  imageData: ImageData,
  params: ReliefParams
): string {
  const heights = imageDataToHeightMap(imageData, params.invert);
  return heightMapToSTL(heights, imageData.width, imageData.height, params);
}
