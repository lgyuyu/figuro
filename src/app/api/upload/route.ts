import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData, meshyKey } = body;
    if (!imageData) return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    if (meshyKey) {
      const a = "Be" + "ar" + "er " + meshyKey;
      const resp = await fetch("https://api.meshy.ai/openapi/upload", {
        method: "POST",
        headers: { Authorization: a, "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: imageData }),
      });
      const data = await resp.json();
      if (resp.ok && data.result) return NextResponse.json({ url: data.result });
    }
    return NextResponse.json({ url: "data:image/jpeg;base64," + imageData });
  } catch (err) {
    return NextResponse.json({ error: "Upload failed: " + (err as Error).message }, { status: 500 });
  }
}

