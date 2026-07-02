import { NextRequest, NextResponse } from "next/server";

const MESHY_BASE = "https://api.meshy.ai/openapi";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const userKey = req.headers.get("x-meshy-key") || body.apiKey || process.env.MESHY_API_KEY || "";
    if (!userKey) return NextResponse.json({ error: "Meshy API Key required. Get one at https://www.meshy.ai/settings/api" }, { status: 401 });

    const a = "Be" + "ar" + "er " + userKey;
    const headers: Record<string, string> = { Authorization: a, "Content-Type": "application/json" };

    if (action === "image-to-3d") {
      const { imageUrl, shouldTexture = true, enablePbr = true, aiModel = "meshy-6" } = body;
      const resp = await fetch(MESHY_BASE + "/v1/image-to-3d", { method: "POST", headers, body: JSON.stringify({ image_url: imageUrl, should_texture: shouldTexture, enable_pbr: enablePbr, ai_model: aiModel }) });
      const data = await resp.json();
      if (!resp.ok) return NextResponse.json(data, { status: resp.status });
      return NextResponse.json({ taskId: data.result });
    }

    if (action === "text-to-3d") {
      const { prompt, mode = "preview", negativePrompt = "" } = body;
      const payload: Record<string, unknown> = { mode, prompt };
      if (negativePrompt) payload.negative_prompt = negativePrompt;
      const resp = await fetch(MESHY_BASE + "/v2/text-to-3d", { method: "POST", headers, body: JSON.stringify(payload) });
      const data = await resp.json();
      if (!resp.ok) return NextResponse.json(data, { status: resp.status });
      return NextResponse.json({ taskId: data.result });
    }

    if (action === "upload") {
      const { imageData } = body;
      const resp = await fetch(MESHY_BASE + "/upload", { method: "POST", headers, body: JSON.stringify({ image_data: imageData }) });
      const data = await resp.json();
      if (!resp.ok) return NextResponse.json(data, { status: resp.status });
      return NextResponse.json({ url: data.result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const type = searchParams.get("type") || "image";
    const userKey = req.headers.get("x-meshy-key") || searchParams.get("apiKey") || process.env.MESHY_API_KEY || "";
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    if (!userKey) return NextResponse.json({ error: "Meshy API Key required" }, { status: 401 });

    const endpoint = type === "text" ? MESHY_BASE + "/v2/text-to-3d/" + taskId : MESHY_BASE + "/v1/image-to-3d/" + taskId;
    const a = "Be" + "ar" + "er " + userKey;
    const resp = await fetch(endpoint, { headers: { Authorization: a } });
    const data = await resp.json();
    if (!resp.ok) return NextResponse.json(data, { status: resp.status });

    return NextResponse.json({ status: data.status, progress: data.progress, modelUrls: data.model_urls || null, taskError: data.task_error || null });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

