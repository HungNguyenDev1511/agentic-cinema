import { NextRequest } from "next/server";

const AGENT_API_URL =
  process.env.AGENT_API_URL ??
  "http://127.0.0.1:8001";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AnalyzeRequest = {
  productionText?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    const productionText = body.productionText?.trim();

    if (!productionText || productionText.length < 20) {
      return Response.json(
        {
          error:
            "Production description must contain at least 20 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const isStream =
      request.nextUrl.searchParams.get("stream") === "1";

    // =====================================================
    // MULTI-AGENT SSE STREAM
    // =====================================================

    if (isStream) {
      const upstreamResponse = await fetch(
        `${AGENT_API_URL}/analyze/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            production_text: productionText,
          }),
          cache: "no-store",
        },
      );

      if (!upstreamResponse.ok) {
        const detail = await upstreamResponse.text();

        return Response.json(
          {
            error: "Agent pipeline failed.",
            detail,
          },
          {
            status: upstreamResponse.status,
          },
        );
      }

      if (!upstreamResponse.body) {
        return Response.json(
          {
            error: "Agent pipeline returned no stream.",
          },
          {
            status: 502,
          },
        );
      }

      return new Response(upstreamResponse.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // =====================================================
    // NORMAL FINAL ANALYSIS
    // =====================================================

    const upstreamResponse = await fetch(
      `${AGENT_API_URL}/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          production_text: productionText,
        }),
        cache: "no-store",
      },
    );

    const rawText = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      return Response.json(
        {
          error: "Unable to analyze production.",
          detail: rawText,
        },
        {
          status: upstreamResponse.status,
        },
      );
    }

    try {
      return Response.json(
        JSON.parse(rawText),
      );
    } catch {
      return Response.json(
        {
          error:
            "Agent API returned invalid JSON.",
          detail: rawText,
        },
        {
          status: 502,
        },
      );
    }
  } catch (error) {
    return Response.json(
      {
        error: "Unable to analyze production.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      },
    );
  }
}