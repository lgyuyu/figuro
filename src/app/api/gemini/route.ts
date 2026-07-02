import { NextRequest, NextResponse } from "next/server";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, prompt, apiKey } = body;

    const geminiKey = req.headers.get("x-gemini-key") || apiKey || "";
    if (!geminiKey) {
      return NextResponse.json({ error: "Need Gemini API key. Get FREE one at https://aistudio.google.com/apikey" }, { status: 401 });
    }
    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: "Image URL and prompt required" }, { status: 400 });
    }

    // Use Gemini 2.5 Flash Image (supports image generation, free tier)
    const model = "gemini-2.5-flash-image-preview";
    const endpoint = GEMINI_BASE + "/models/" + model + ":generateContent?key=" + geminiKey;

    const payload = {
      contents: [{
        parts: [
          { text: "Based on this image, " + prompt + ". Create a new image." },
          { file_data: { mime_type: "image/jpeg", file_uri: imageUrl } }
        ]
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const errMsg = data?.error?.message || "Gemini API error";
      return NextResponse.json({ error: errMsg }, { status: resp.status });
    }

    // Extract image from response
    const candidates = data?.candidates || [];
    let generatedImageUrl = null;
    let textResult = "";

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          // Image returned as base64 inline data
          const mime = part.inlineData.mimeType || "image/png";
          generatedImageUrl = "data:" + mime + ";base64," + part.inlineData.data;
        }
        if (part.text) {
          textResult += part.text;
        }
      }
    }

    return NextResponse.json({ success: true, generatedImageUrl, result: textResult, model });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

