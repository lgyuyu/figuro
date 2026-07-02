import { NextRequest, NextResponse } from "next/server";

const HF_SPACE = "https://tencent-hunyuan3d-2.hf.space";

interface GradioResult {
  status: string;
  modelUrl?: string | null;
  error?: string;
}

// POST: submit generation task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Step 1: Upload image to Gradio
    if (action === "upload") {
      const { imageData } = body;
      const buf = Buffer.from(imageData, "base64");

      const boundary = "----FormBoundary" + Date.now();
      const bodyParts = [
        "--" + boundary + "\r\n",
        'Content-Disposition: form-data; name="files"; filename="input.jpg"\r\n',
        "Content-Type: image/jpeg\r\n\r\n",
      ];
      const bodyEnd = "\r\n--" + boundary + "--\r\n";

      const bodyBuf = Buffer.concat([
        Buffer.from(bodyParts.join("")),
        buf,
        Buffer.from(bodyEnd),
      ]);

      const resp = await fetch(HF_SPACE + "/api/upload", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=" + boundary },
        body: bodyBuf,
      });

      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: "Upload failed: " + text.substring(0, 200) }, { status: 500 });
      }

      const result = await resp.json();
      const filePath = Array.isArray(result) ? result[0] : result;
      return NextResponse.json({ url: filePath });
    }

    // Step 2: Submit 3D generation task
    if (action === "generate") {
      const { imagePath } = body;
      const sessionHash = "figuro_" + Date.now() + "_" + Math.random().toString(36).substring(7);

      const joinData = {
        data: [
          "",
          { path: imagePath, meta: { _type: "gradio.FileData" } },
          null, null, null, null,
          30, 7.5, Math.floor(Math.random() * 99999), 128, true, 100000, true,
        ],
        event_data: null,
        fn_index: 8,
        session_hash: sessionHash,
      };

      const joinResp = await fetch(HF_SPACE + "/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(joinData),
      });

      const joinResult = await joinResp.json();
      return NextResponse.json({ sessionHash, eventId: joinResult.event_id });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

// GET: poll task via SSE
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionHash = searchParams.get("sessionHash");

  if (!sessionHash) {
    return NextResponse.json({ error: "Missing sessionHash" }, { status: 400 });
  }

  try {
    // Connect to SSE stream and read until completion
    const sseResp = await fetch(HF_SPACE + "/queue/data?session_hash=" + sessionHash, {
      headers: { Accept: "text/event-stream" },
    });

    const reader = sseResp.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No SSE stream" }, { status: 500 });
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          try {
            const data = JSON.parse(trimmed.substring(5).trim());
            const msg = data.msg || "";

            if (msg === "process_completed") {
              const output = data.output || {};
              if (output.error) {
                return NextResponse.json({ status: "ERROR", error: output.error });
              }

              const results = output.data || [];
              let modelUrl: string | null = null;

              for (const item of results) {
                if (item && typeof item === "object") {
                  const url = item.url || "";
                  const path = item.path || "";
                  if (url && (url.endsWith(".glb") || url.endsWith(".obj") || url.endsWith(".ply") || url.includes(".glb"))) {
                    modelUrl = url;
                  } else if (path && (path.endsWith(".glb") || path.endsWith(".obj"))) {
                    modelUrl = HF_SPACE + "/file=" + path;
                  }
                }
              }

              return NextResponse.json({ status: "COMPLETED", modelUrl, raw: results });
            }

            if (msg === "process_starts") {
              // Keep waiting
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    return NextResponse.json({ status: "TIMEOUT" });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

