"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Source {
  id: string;
  documentTitle: string;
  pageNumber?: number;
  heading?: string;
  content: string;
  chunkIndex: number;
}

export function CitationCard({
  source,
  index,
  expanded,
  onToggle,
}: {
  source: Source;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={onToggle}
    >
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-mono">
            Source {index + 1}
          </Badge>
          <CardTitle className="text-sm font-medium truncate">
            {source.documentTitle}
          </CardTitle>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {source.pageNumber && <span>Page {source.pageNumber}</span>}
          {source.heading && <span>{source.heading}</span>}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-3 pt-1">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {source.content}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
