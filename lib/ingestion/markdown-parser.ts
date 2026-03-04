import { unified } from "unified";
import remarkParse from "remark-parse";

interface MarkdownSection {
  text: string;
  heading?: string;
}

export async function parseMarkdown(
  content: string,
  title?: string
): Promise<{ title: string; sections: MarkdownSection[] }> {
  const tree = unified().use(remarkParse).parse(content);

  const sections: MarkdownSection[] = [];
  let currentHeading: string | undefined;
  let currentText = "";

  function extractText(node: any): string {
    if (node.type === "text" || node.type === "inlineCode") {
      return node.value;
    }
    if (node.children) {
      return node.children.map(extractText).join("");
    }
    if (node.type === "code") {
      return `\n\`\`\`${node.lang || ""}\n${node.value}\n\`\`\`\n`;
    }
    return "";
  }

  for (const node of tree.children) {
    if (node.type === "heading") {
      // Save previous section
      if (currentText.trim()) {
        sections.push({ text: currentText.trim(), heading: currentHeading });
      }
      currentHeading = extractText(node);
      currentText = "";
    } else {
      currentText += extractText(node) + "\n";
    }
  }

  // Final section
  if (currentText.trim()) {
    sections.push({ text: currentText.trim(), heading: currentHeading });
  }

  const docTitle =
    title || sections.find((s) => s.heading)?.heading || "Markdown Document";

  return { title: docTitle, sections };
}
