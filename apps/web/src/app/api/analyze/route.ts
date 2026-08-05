import { NextRequest, NextResponse } from "next/server";

const AGENT_API_URL =
  process.env.AGENT_API_URL ?? "http://127.0.0.1:8001";

type AnalyzeRequest = {
  productionText?: string;
};

type AgentApiError = {
  detail?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeRequest;
    const productionText = body.productionText?.trim();

    if (!productionText || productionText.length < 20) {
      return NextResponse.json(
        {
          error: "Production description must contain at least 20 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const response = await fetch(`${AGENT_API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        production_text: productionText,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = "Agent API request failed.";

      try {
        const errorBody = (await response.json()) as AgentApiError;

        if (errorBody.detail) {
          detail = errorBody.detail;
        }
      } catch {
        const rawError = await response.text();

        if (rawError) {
          detail = rawError;
        }
      }

      return NextResponse.json(
        {
          error: "Unable to analyze production.",
          detail,
        },
        {
          status: response.status,
        },
      );
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected analysis error.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      {
        status: 500,
      },
    );
  }
}