import { NextRequest, NextResponse } from "next/server";

const FAL_QUEUE = "https://queue.fal.run/fal-ai/trellis";

function makeAuth(key: string) {
  return "Key " + key;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const falKey = req.headers.get("x-fal-key") || body.falKey || "";

    if (!falKey) {
      return NextResponse.json({ error: "Need fal.ai API key. Get one at https://fal.ai/dashboard/keys" }, { status: 401 });
    }

    const auth = makeAuth(falKey);

    if (action === "upload") {
      const { imageData } = body;
      const buf = Buffer.from(imageData, "base64");
      const upResp = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: "input.jpg", content_type: "image/jpeg" }),
      });
      const upData = await upResp.json();
      if (!upData.upload_url) return NextResponse.json({ error: "Upload init failed" }, { status: 500 });

      await fetch(upData.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: buf,
      });

      return NextResponse.json({ url: upData.file_url || upData.url });
    }

    if (action === "generate") {
      const { imageUrl } = body;
      const resp = await fetch(FAL_QUEUE, {
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
      if (!resp.ok) return NextResponse.json({ error: JSON.stringify(data) }, { status: resp.status });
      return NextResponse.json({ requestId: data.request_id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    const falKey = req.headers.get("x-fal-key") || searchParams.get("falKey") || "";

    if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    if (!falKey) return NextResponse.json({ error: "Need fal.ai API key" }, { status: 401 });

    const auth = makeAuth(falKey);
    const statusResp = await fetch(FAL_QUEUE + "/requests/" + requestId + "/status", {
      headers: { Authorization: auth },    });
    const statusData = await statusResp.json();

    if (statusData.status === "COMPLETED") {
      const resultResp = await fetch(FAL_QUEUE + "/requests/" + requestId, {
        headers: { Authorization: auth },      });
      const resultData = await resultResp.json();
      const modelUrl = resultData?.model_url || resultData?.glb_url || resultData?.output?.model_url || null;
      return NextResponse.json({ status: "COMPLETED", modelUrl, raw: resultData });
    }

    return NextResponse.json({ status: statusData.status });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

