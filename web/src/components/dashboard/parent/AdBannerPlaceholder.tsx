"use client";

interface AdBannerPlaceholderProps {
  onUpgrade: () => void;
  variant?: "top" | "bottom";
}

export function AdBannerPlaceholder({ onUpgrade, variant = "top" }: AdBannerPlaceholderProps) {
  return (
    <div
      className="card"
      style={{
        border: "1px dashed var(--border)",
        background: "var(--surface-1)",
        textAlign: "center",
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {variant === "top" ? "Sponsored learning tips" : "Support the app"}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
        Upgrade to remove ads and unlock extra parent tools.
      </div>
      <button className="btn btnPrimary" onClick={onUpgrade}>
        Upgrade
      </button>
    </div>
  );
}
