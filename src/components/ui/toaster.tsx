"use client";

import { Toaster as Sonner } from "sonner";

/** App-wide toast host, mounted once in the root layout. Use `toast()` from
 * "sonner" anywhere in a client component to show feedback. */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast: "!bg-card !text-card-foreground !border-border",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}
