"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { QueryInput } from "./query-input";
import { CitationCard, Source } from "./citation-card";

function getTextFromParts(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p) => p.type === "text" && p.text)
    .map((p) => p.text!)
    .join("");
}

export function Chat() {
  const [sources, setSources] = useState<Map<string, Source[]>>(new Map());
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    onFinish: ({ message }) => {
      setSources((prev) => {
        const next = new Map(prev);
        const pending = next.get("pending");
        if (pending) {
          next.set(message.id, pending);
          next.delete("pending");
        }
        return next;
      });
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const text = input;
      setInput("");

      // Fetch sources from response headers
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const sourcesHeader = response.headers.get("X-Sources");
        if (sourcesHeader) {
          try {
            const parsed = JSON.parse(sourcesHeader) as Source[];
            setSources((prev) => {
              const next = new Map(prev);
              next.set("pending", parsed);
              return next;
            });
          } catch {
            // ignore
          }
        }
        window.fetch = originalFetch;
        return response;
      };

      sendMessage({ text });
    },
    [input, isLoading, sendMessage]
  );

  const renderMessageContent = useCallback(
    (text: string, messageId: string) => {
      const messageSources = sources.get(messageId);
      const parts = text.split(/(\[Source\s+\d+\])/g);

      return parts.map((part, i) => {
        const match = part.match(/\[Source\s+(\d+)\]/);
        if (match && messageSources) {
          const sourceIndex = parseInt(match[1], 10) - 1;
          return (
            <Badge
              key={i}
              variant="outline"
              className="cursor-pointer text-xs mx-0.5 hover:bg-accent"
              onClick={() =>
                setExpandedCitation(
                  expandedCitation === `${messageId}-${sourceIndex}`
                    ? null
                    : `${messageId}-${sourceIndex}`
                )
              }
            >
              Source {sourceIndex + 1}
            </Badge>
          );
        }
        return <span key={i}>{part}</span>;
      });
    },
    [sources, expandedCitation]
  );

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <h2 className="text-lg font-medium mb-2">
                RAG Document Assistant
              </h2>
              <p className="text-sm">
                Upload documents and ask questions. Answers are grounded in your
                documents with verifiable citations.
              </p>
            </div>
          )}

          {messages.map((message) => {
            const text = getTextFromParts(message.parts as any);
            return (
              <div key={message.id}>
                <div
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[85%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.role === "assistant"
                        ? renderMessageContent(text, message.id)
                        : text}
                    </div>
                  </div>
                </div>

                {message.role === "assistant" && sources.get(message.id) && (
                  <div className="mt-2 space-y-1 ml-0">
                    {sources.get(message.id)!.map((source, idx) => (
                      <CitationCard
                        key={source.id}
                        source={source}
                        index={idx}
                        expanded={
                          expandedCitation === `${message.id}-${idx}`
                        }
                        onToggle={() =>
                          setExpandedCitation(
                            expandedCitation === `${message.id}-${idx}`
                              ? null
                              : `${message.id}-${idx}`
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-sm">
              Error: {error.message}
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto">
          <QueryInput
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
