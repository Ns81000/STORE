import { useState } from "react";
import { initialsOf } from "@/lib/store.types";
import { cn } from "@/lib/utils";

type SvgMarkProps = {
  url: string | null;
  fallback: string;
  className?: string;
  size?: number;
};

/**
 * Marks render bare — no plate, no box, no background. When a URL is missing
 * or broken we fall back to plain tinted initials so nothing ever looks broken.
 */
export function SvgMark({ url, fallback, className, size = 22 }: SvgMarkProps) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center font-semibold tracking-tight text-ink-subtle",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.46) }}
      >
        {initialsOf(fallback)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
