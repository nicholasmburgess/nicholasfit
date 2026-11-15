export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-accent-ink font-semibold",
    secondary: "bg-card-2 text-text border border-line",
    ghost: "text-muted",
    danger: "text-danger border border-danger/40",
  }[variant];
  return (
    <button className={`rounded-xl px-4 py-3 text-sm active:opacity-80 disabled:opacity-50 ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
