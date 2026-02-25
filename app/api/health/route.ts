import { NextResponse } from "next/server";

import { getAnthropicEnvKeyStatus } from "@/lib/server/anthropic-client";

export async function GET() {
  const anthropic = getAnthropicEnvKeyStatus();

  return NextResponse.json({
    ok: true,
    version: "0.1.0",
    anthropic: {
      hasServerKey: anthropic.hasKey,
      keySource: anthropic.source,
    },
  });
}
