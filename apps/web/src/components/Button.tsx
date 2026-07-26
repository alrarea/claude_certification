import type { ButtonHTMLAttributes } from "react";
import { Spark } from "./Spark";

type Variant = "primary" | "clay" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
  size?: "md" | "sm";
}

export function Button({
  variant = "primary",
  loading = false,
  block = false,
  size = "md",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", block ? "btn-block" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Spark size={15} />}
      {children}
    </button>
  );
}
