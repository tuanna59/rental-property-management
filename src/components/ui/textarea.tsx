import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-[#cfd9d1] bg-white px-3 py-2 text-sm text-[#1d2d29] shadow-sm transition-colors placeholder:text-[#708078] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6f5b] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
