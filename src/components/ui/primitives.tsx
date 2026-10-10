"use client";

import { useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "ghost" };

export function Button({ variant = "quiet", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-basil px-6 py-3 text-[15px] text-white hover:bg-basil-strong",
        variant === "quiet" && "border border-mist-strong bg-surface px-4 py-2 text-sm text-charcoal hover:border-basil hover:text-basil",
        variant === "ghost" && "px-2.5 py-1.5 text-sm text-charcoal-soft hover:bg-mist hover:text-charcoal",
        className,
      )}
    />
  );
}

/** Accessible segmented control (radio group) used for tabs, styles, units and locale. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode; hint?: string }>;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-mist p-1">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "rounded-full font-medium transition-colors",
              size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-1.5 text-sm",
              active ? "bg-surface text-charcoal shadow-sm" : "text-charcoal-soft hover:text-charcoal",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
  uncertain,
}: {
  label: string;
  children: (id: string) => ReactNode;
  className?: string;
  uncertain?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-charcoal-soft">
        {label}
      </label>
      <div className={cn("rounded-[10px]", uncertain && "ring-2 ring-saffron ring-offset-1 ring-offset-surface")}>
        {children(id)}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-mist-strong bg-surface px-3 py-2 text-[15px] text-charcoal placeholder:text-charcoal-soft/70 focus:border-basil focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-basil/30";

export function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-mist bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Text input that keeps what the user types and commits on blur or Enter, so parsing never fights typing. */
export function CommitInput({
  value,
  onCommit,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue"> & {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    // The committed value changed elsewhere (new import, unit edit): follow it.
    setPrev(value);
    setDraft(value);
  }
  return (
    <input
      {...props}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        props.onKeyDown?.(e);
      }}
    />
  );
}
