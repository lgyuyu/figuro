# Figuro 🎨🖨️

**图片 → 3D 浮雕 → STL 打印文件**

上传任意图片（手绘草图、照片、Logo、设计图），在线转换为可 3D 打印的 STL 浮雕模型。

## ✨ 功能

- 📤 上传图片（JPG/PNG/WebP）
- 🎛️ 实时调节打印参数（尺寸、高度、平滑度等）
- 👆 Three.js 3D 实时预览（拖拽旋转、滚轮缩放）
- 💾 一键导出标准 STL 文件（兼容 Cura / PrusaSlicer / Bambu Studio）
- 📱 纯前端运行，无需服务器

## 🚀 技术栈

- **Next.js 15** + **React 19**
- **Three.js** + **React Three Fiber** — 3D 渲染
- **Canvas API** — 图片灰度处理
- **TypeScript** — 类型安全

## 🏗️ 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000

## 📐 原理

```
图片 → Canvas 灰度提取 → 高度图(0-1) → 平滑滤波 → STL三角网格
```

核心算法借鉴 [Video-QRcode-Generator](https://github.com/une-glace/Video-QRcode-Generator) 的二维码 STL 生成逻辑，从「黑白像素→方块高度」升级为「灰度像素→连续高度场」。

## 📦 部署

部署到 Vercel：

```bash
vercel --prod
```

## License

MIT
