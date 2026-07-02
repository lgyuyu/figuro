import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, prompt, apiKey } = body;

    const openrouterKey = req.headers.get("x-openrouter-key") || apiKey || process.env.OPENROUTER_API_KEY || "";
    if (!openrouterKey) return NextResponse.json({ error: "OpenRouter API Key required. Get one at https://openrouter.ai/keys" }, { status: 401 });
    if (!imageUrl || !prompt) return NextResponse.json({ error: "Image URL and prompt required" }, { status: 400 });

    const a = "Be" + "ar" + "er " + openrouterKey;
    const completion = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: a,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://figuro.vercel.app",
        "X-Title": "Figuro",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["text", "image"],
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: "Based on this image, " + prompt + ". Create a new image that follows this instruction while maintaining high quality and coherence." },
          ],
        }],
        max_tokens: 1000,
      }),
    });

    const data = await completion.json();
    if (!completion.ok) {
      const errMsg = data?.error?.message || "OpenRouter API error: " + completion.status;
      return NextResponse.json({ error: errMsg }, { status: completion.status });
    }

    const message = data.choices?.[0]?.message;
    const generatedImages = message?.images;
    let generatedImageUrl = null;
    if (generatedImages && generatedImages.length > 0) generatedImageUrl = generatedImages[0].image_url?.url;

    if (!generatedImageUrl && message?.content) {
      const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
      const match = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
      if (match) generatedImageUrl = match[1];
    }

    return NextResponse.json({ success: true, generatedImageUrl, result: typeof message?.content === "string" ? message.content : "", model: "google/gemini-2.5-flash-image" });
  } catch (err) {
    return NextResponse.json({ error: "Server error: " + (err as Error).message }, { status: 500 });
  }
}

