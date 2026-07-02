import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Figuro — 图片转3D打印",
  description: "上传图片，一键生成可3D打印的STL浮雕模型文件",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
