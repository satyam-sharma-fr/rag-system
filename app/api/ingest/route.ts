import { NextRequest, NextResponse } from "next/server";
import {
  ingestPdf,
  ingestMarkdown,
  ingestWebPage,
  ingestText,
} from "@/lib/ingestion/ingest";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle URL ingestion
    if (contentType.includes("application/json")) {
      const { url } = await req.json();
      if (!url || typeof url !== "string") {
        return NextResponse.json(
          { error: "URL is required" },
          { status: 400 }
        );
      }

      const result = await ingestWebPage(url);
      return NextResponse.json({
        success: true,
        documentId: result.documentId,
        chunkCount: result.chunkCount,
      });
    }

    // Handle file upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const extension = fileName.split(".").pop()?.toLowerCase();

    let result;

    if (extension === "pdf") {
      const buffer = Buffer.from(await file.arrayBuffer());
      result = await ingestPdf(buffer, fileName);
    } else if (extension === "md" || extension === "markdown") {
      const text = await file.text();
      result = await ingestMarkdown(text, fileName);
    } else if (extension === "txt") {
      const text = await file.text();
      result = await ingestText(text, fileName);
    } else if (extension === "html" || extension === "htm") {
      const { parseHtml } = await import("@/lib/ingestion/web-parser");
      const html = await file.text();
      const { title, text } = parseHtml(html, fileName);
      result = await ingestText(text, title);
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${extension}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
