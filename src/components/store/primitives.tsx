import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "surface" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
};

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:brightness-110",
  surface: "bg-surface-2 text-ink hover:bg-surface-3",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-error text-on-accent hover:brightness-110",
} satisfies Record<ButtonVariant, string>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "press focus-ring inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "md" ? "h-11 px-5 text-[0.9375rem]" : "h-9 px-3.5 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "muted" | "solid";
  size?: "md" | "sm";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = "muted", size = "md", className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "press focus-ring inline-flex shrink-0 items-center justify-center rounded-md",
        size === "md" ? "h-10 w-10" : "h-8 w-8",
        tone === "muted"
          ? "text-ink-muted hover:bg-surface-2 hover:text-ink"
          : "bg-surface-2 text-ink hover:bg-surface-3",
        className,
      )}
      {...rest}
    />
  );
});

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: ReactNode;
  invalid?: boolean;
  adornment?: ReactNode;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, invalid, adornment, className, id, ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {label ? (
        <label htmlFor={inputId} className="type-label">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-md bg-surface-2 px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-subtle",
            "outline-none transition-[box-shadow,background-color] duration-200",
            "focus:bg-surface-3 focus:shadow-[var(--glow-accent)]",
            invalid && "shadow-[0_0_0_2px_var(--error)]",
            adornment && "pr-12",
            className,
          )}
          {...rest}
        />
        {adornment ? (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{adornment}</div>
        ) : null}
      </div>
      {hint ? (
        <p className={cn("type-caption", invalid && "text-error")}>{hint}</p>
      ) : null}
    </div>
  );
});

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ invalid, className, ...rest }, ref) {
    const [revealed, setRevealed] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={revealed ? "text" : "password"}
          className={cn(
            "h-14 w-full rounded-lg bg-surface-2/90 pl-5 pr-14 text-base text-ink placeholder:text-ink-subtle",
            "outline-none backdrop-blur transition-[box-shadow,background-color,transform] duration-300",
            "focus:-translate-y-0.5 focus:bg-surface-3 focus:shadow-[var(--elev-2),var(--glow-accent)]",
            invalid && "shadow-[0_0_0_2px_var(--error)]",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          aria-label={revealed ? "Hide password" : "Show password"}
          className="press focus-ring absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-subtle hover:text-ink"
        >
          {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    );
  },
);

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
};

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-ring relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-250",
        checked ? "bg-accent" : "bg-surface-3",
      )}
      style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-pill transition-transform duration-250",
          checked ? "bg-on-accent" : "bg-ink-muted",
        )}
        style={{
          transform: checked ? "translateX(24px)" : "translateX(4px)",
          transitionTimingFunction: "var(--ease-spring)",
        }}
      />
    </button>
  );
}

type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode };

type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (next: T) => void;
  size?: "md" | "sm";
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex w-full overflow-hidden rounded-md bg-surface-2 p-1",
        size === "sm" && "p-0.5",
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "focus-ring flex min-w-0 flex-1 items-center justify-center gap-1.5 truncate rounded-sm px-2 font-medium transition-colors duration-200",
              size === "md" ? "h-9 text-sm" : "h-7 text-xs",
              active
                ? "bg-accent text-on-accent shadow-[var(--elev-1)]"
                : "text-ink-muted hover:text-ink",
            )}
            style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="animate-pop flex flex-col items-center justify-center rounded-xl bg-surface px-6 py-16 text-center elev-1">
      <h3 className="type-display-sm">{title}</h3>
      <p className="type-caption mt-3 max-w-sm">{body}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="animate-pop fixed bottom-28 left-1/2 z-[80] -translate-x-1/2 rounded-pill bg-surface-3 px-5 py-2.5 text-sm text-ink elev-3 md:bottom-10"
    >
      {message}
    </div>
  );
}
