import { runRagPipeline } from "@/lib/ai/rag-pipeline";
import { UIMessage } from "ai";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: UIMessage[] };
    const lastMessage = messages[messages.length - 1];

    // Extract text from parts-based message format
    const query = lastMessage.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ");

    if (!query) {
      return Response.json({ error: "No message provided" }, { status: 400 });
    }

    const { result, sources } = await runRagPipeline(query);

    return result.toUIMessageStreamResponse({
      headers: {
        "X-Sources": JSON.stringify(
          sources.map((s) => ({
            id: s.id,
            documentTitle: s.documentTitle,
            pageNumber: s.pageNumber,
            heading: s.heading,
            content: s.content.slice(0, 200),
            chunkIndex: s.chunkIndex,
          }))
        ),
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
