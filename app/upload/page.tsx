import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Upload Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add documents to the knowledge base. Supported formats: PDF,
            Markdown, TXT, HTML, or web URLs.
          </p>
        </div>
        <UploadForm />
      </div>
    </div>
  );
}
