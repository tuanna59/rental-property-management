"use client";

import * as React from "react";
import { Camera, FileText, ImagePlus, Paperclip, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type PrivateAttachmentVariant = "card" | "inline" | "icon";

export function PrivateAttachmentPicker({
  name,
  accept,
  multiple = false,
  required = false,
  title,
  emptyText,
  actionLabel,
  existingCount = 0,
  kind = "file",
  variant = "card",
  autoSubmit = false,
  helperText,
  disabled = false,
  className,
}: {
  name: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  title: string;
  emptyText?: string;
  actionLabel: string;
  existingCount?: number;
  kind?: "file" | "image" | "receipt";
  variant?: PrivateAttachmentVariant;
  autoSubmit?: boolean;
  helperText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = React.useId();
  const tCommon = useTranslations("common");
  const [files, setFiles] = React.useState<File[]>([]);
  const Icon = kind === "image" ? ImagePlus : kind === "receipt" ? FileText : Paperclip;
  const selectedLabel = files.length
    ? files.length === 1 && files[0]?.name
      ? files[0].name
      : tCommon("filesSelected", { count: files.length })
    : existingCount > 0
      ? tCommon("attachmentsCount", { count: existingCount })
      : emptyText ?? tCommon("noAttachmentSelected");

  const input = (
    <input
      id={id}
      className="private-attachment-input"
      type="file"
      name={name}
      accept={accept}
      multiple={multiple}
      required={required}
      disabled={disabled}
      onChange={(event) => {
        const selectedFiles = Array.from(event.currentTarget.files ?? []);
        const form = event.currentTarget.form;
        setFiles(selectedFiles);
        if (autoSubmit && selectedFiles.length > 0) form?.requestSubmit();
      }}
    />
  );

  if (variant === "icon") {
    return (
      <label
        className={cn("private-attachment-icon-trigger", className)}
        htmlFor={id}
        title={actionLabel}
      >
        <Camera aria-hidden="true" />
        <span className="sr-only">{actionLabel}</span>
        {input}
      </label>
    );
  }

  if (variant === "inline") {
    return (
      <label
        className={cn("private-attachment-inline-trigger", className)}
        htmlFor={id}
        title={files.length ? selectedLabel : actionLabel}
      >
        <Upload aria-hidden="true" />
        <span>{files.length ? tCommon("changeSelection") : actionLabel}</span>
        {input}
      </label>
    );
  }

  return (
    <div className={cn("private-attachment-picker", className)}>
      <div className="private-attachment-copy">
        <span className="private-attachment-icon"><Icon aria-hidden="true" /></span>
        <span>
          <strong>{title}</strong>
          <small>{selectedLabel}</small>
          {helperText && <em>{helperText}</em>}
        </span>
      </div>
      <label className="private-attachment-button" htmlFor={id}>
        <Upload aria-hidden="true" />
        {files.length ? tCommon("changeSelection") : actionLabel}
      </label>
      {input}
    </div>
  );
}
