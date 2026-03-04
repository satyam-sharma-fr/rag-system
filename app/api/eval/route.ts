import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  // Eval is run via the CLI script (eval/run-eval.ts), not via API
  return NextResponse.json({
    message: "Run eval via: npx tsx eval/run-eval.ts",
  });
}
