/**
 * Meshy API 代理 — 后端 API Route
 * 
 * 为什么需要这个？
 *   Meshy API 禁止浏览器 CORS 直接调用，必须通过服务器代理。
 *   这个 Route 负责转发请求到 Meshy API，隐藏 API Key。
 *
 * 流程：
 *   1. 前端上传图片 → POST /api/meshy/create → 获取 task_id
 *   2. 前端轮询 → GET /api/meshy/status?task_id=xxx → 获取模型 URL
 *   3. 前端下载 GLB → 可选转 STL
 */

import { NextRequest, NextResponse } from "next/server";

const MESHY_BASE = "https://api.meshy.ai/openapi";

function getApiKey() {
  // 支持环境变量或 header 传入（让用户在前端填自己的 key）
  return process.env.MESHY_API_KEY || "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 从 header 或 body 获取用户自己的 API key
    const userKey = req.headers.get("x-meshy-key") || body.apiKey || getApiKey();

    if (!userKey) {
      return NextResponse.json(
        { error: "需要提供 Meshy API Key。在 https://www.meshy.ai/settings/api 免费获取" },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${userKey}`,
      "Content-Type": "application/json",
    };

    if (action === "image-to-3d") {
      // 创建 Image to 3D 任务
      const { imageUrl, shouldTexture = true, enablePbr = true, aiModel = "meshy-6" } = body;

      const payload: Record<string, unknown> = {
        image_url: imageUrl,
        should_texture: shouldTexture,
        enable_pbr: enablePbr,
        ai_model: aiModel,
      };

      const resp = await fetch(`${MESHY_BASE}/v1/image-to-3d`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        return NextResponse.json(data, { status: resp.status });
      }

      return NextResponse.json({ taskId: data.result });
    }

    if (action === "text-to-3d") {
      // 创建 Text to 3D 任务 (preview)
      const { prompt, mode = "preview", negativePrompt = "" } = body;

      const payload: Record<string, unknown> = {
        mode,
        prompt,
      };

      if (negativePrompt) {
        payload.negative_prompt = negativePrompt;
      }

      const resp = await fetch(`${MESHY_BASE}/v2/text-to-3d`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        return NextResponse.json(data, { status: resp.status });
      }

      return NextResponse.json({ taskId: data.result });
    }

    if (action === "upload") {
      // 上传图片到 Meshy 获取 URL
      const { imageData } = body;

      const resp = await fetch(`${MESHY_BASE}/upload`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_data: imageData }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        return NextResponse.json(data, { status: resp.status });
      }

      return NextResponse.json({ url: data.result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Meshy API error:", err);
    return NextResponse.json(
      { error: "服务器错误: " + (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const type = searchParams.get("type") || "image"; // image | text
    const userKey =
      req.headers.get("x-meshy-key") ||
      searchParams.get("apiKey") ||
      getApiKey();

    if (!taskId) {
      return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
    }

    if (!userKey) {
      return NextResponse.json(
        { error: "需要提供 Meshy API Key" },
        { status: 401 }
      );
    }

    const endpoint =
      type === "text"
        ? `${MESHY_BASE}/v2/text-to-3d/${taskId}`
        : `${MESHY_BASE}/v1/image-to-3d/${taskId}`;

    const resp = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${userKey}`,
      },
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    // 返回精简的状态信息
    return NextResponse.json({
      status: data.status,
      progress: data.progress,
      modelUrls: data.model_urls || null,
      taskError: data.task_error || null,
    });
  } catch (err) {
    console.error("Meshy poll error:", err);
    return NextResponse.json(
      { error: "服务器错误: " + (err as Error).message },
      { status: 500 }
    );
  }
}
