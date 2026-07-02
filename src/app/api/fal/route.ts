import { NextRequest, NextResponse } from "next/server";

const FAL_QUEUE = "https://queue.fal.run";

function makeAuth(key: string) {
  return "Key " + key;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const falKey = req.headers.get("x-fal-key") || body.falKey || "";

    if (!falKey) {
      return NextResponse.json({ error: "Need fal.ai API key. Get  free at https://fal.ai/dashboard/keys" }, { status: 401 });
    }

    const auth = makeAuth(falKey);

    // === Upload image to fal storage ===
    if (action === "upload") {
      const { imageData } = body;
      const buf = Buffer.from(imageData, "base64");
      const upResp = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: "input.jpg", content_type: "image/jpeg" }),
      });
      const upData = await upResp.json();
      if (!upData.upload_url) return NextResponse.json({ error: "Upload init failed: " + JSON.stringify(upData) }, { status: 500 });
      await fetch(upData.upload_url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: buf });
      return NextResponse.json({ url: upData.file_url || upData.url });
    }

    // === Flux Image Generation (text-to-image or image-to-image) ===
    if (action === "generate-image") {
      const { prompt, imageUrl } = body;
      const model = imageUrl ? "fal-ai/flux/dev" : "fal-ai/flux/schnell";
      const payload: Record<string, unknown> = { prompt, num_images: 1 };
      if (imageUrl) payload.image_url = imageUrl;

      const resp = await fetch(FAL_QUEUE + "/" + model, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) return NextResponse.json({ error: JSON.stringify(data).substring(0, 500) }, { status: resp.status });
      return NextResponse.json({ requestId: data.request_id });
    }

    // === Trellis 3D Generation ===
    if (action === "generate-3d") {
      const { imageUrl } = body;
      const resp = await fetch(FAL_QUEUE + "/fal-ai/trellis", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          ss_guidance_strength: 7.5,
          ss_sampling_steps: 12,
          slat_guidance_strength: 3,
          slat_sampling_steps: 12,
          mesh_simplify: 0.95,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) return NextResponse.json({ error: JSON.stringify(data).substring(0, 500) }, { status: resp.status });
      return NextResponse.json({ requestId: data.request_id });
    }

    return NextResponse.json({ error: "Unknown action: " + action }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

// === Poll task status ===
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    const model = searchParams.get("model") || "fal-ai/trellis";
    const falKey = req.headers.get("x-fal-key") || searchParams.get("falKey") || "";

    if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    if (!falKey) return NextResponse.json({ error: "Need fal.ai API key" }, { status: 401 });

    const auth = makeAuth(falKey);
    const queueUrl = FAL_QUEUE + "/" + model;
    const statusResp = await fetch(queueUrl + "/requests/" + requestId + "/status", {
      headers: { Authorization: auth },
    });
    const statusData = await statusResp.json();

    if (statusData.status === "COMPLETED") {
      const resultResp = await fetch(queueUrl + "/requests/" + requestId, {
        headers: { Authorization: auth },
      });
      const resultData = await resultResp.json();
      const data = resultData.data || resultData;

      // For image generation: data.images[0].url
      // For 3D: data.model_url or data.glb_url
      let imageUrl = null;
      let modelUrl = null;

      if (data?.images && data.images.length > 0) {
        imageUrl = data.images[0].url;
      }
      if (data?.model_url) modelUrl = data.model_url;
      if (data?.glb_url) modelUrl = data.glb_url;
      if (data?.output?.model_url) modelUrl = data.output.model_url;

      return NextResponse.json({ status: "COMPLETED", imageUrl, modelUrl, raw: data });
    }

    return NextResponse.json({ status: statusData.status, logs: statusData.logs });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

