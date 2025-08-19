import React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type FileDropzoneProps = {
  id: string;
  accept?: string;
  onFile: (file: File) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
};

export function FileDropzone({
  id,
  accept,
  onFile,
  placeholder = "Click to select a file or drag & drop here",
  loading = false,
  className,
}: FileDropzoneProps) {
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "relative group flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 py-12 text-center hover:bg-accent",
        className
      )}
    >
      <input id={id} type="file" accept={accept} onChange={onSelect} className="hidden" />
      <Label
        htmlFor={id}
        className="absolute inset-0 flex items-center justify-center cursor-pointer transition-colors group-hover:text-white"
      >
        {loading ? "Uploading..." : placeholder}
      </Label>
    </div>
  );
}


