import { useState } from "react";

// Deterministic bg color from string
function colorFor(name = "") {
  const colors = [
    "#5B4FFF", "#C6F76A", "#FF6B9D", "#FFB84D", "#4ECDC4",
    "#A78BFA", "#F97316", "#10B981", "#3B82F6", "#EF4444",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

// CompanyLogo — displays logo image with graceful fallback to a colored initial-letter tile.
// Also tries a backend proxy fallback before giving up.
export default function CompanyLogo({ company = "", src, size = 40, className = "", rounded = "rounded-lg" }) {
  const [step, setStep] = useState(0); // 0 = original src, 1 = backend proxy, 2 = fallback tile
  const initial = (company || "?")[0].toUpperCase();
  const bg = colorFor(company);

  const currentSrc = (() => {
    // Prefer backend proxy first — it caches and cascades through multiple sources
    if (step === 0 && company) {
      let domain = "";
      if (src?.includes("clearbit.com/")) domain = src.split("clearbit.com/")[1].split("?")[0];
      else domain = `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
      return `${process.env.REACT_APP_BACKEND_URL}/api/logo/${domain}`;
    }
    if (step === 1 && src) return src;
    return null;
  })();

  if (step >= 2 || !currentSrc) {
    return (
      <div
        className={`${rounded} flex items-center justify-center shrink-0 font-display font-bold text-white ${className}`}
        style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
        data-testid="logo-fallback"
      >
        {initial}
      </div>
    );
  }
  return (
    <img
      src={currentSrc}
      alt={company}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setStep((s) => s + 1)}
      className={`${rounded} bg-white shrink-0 object-contain ${className}`}
      style={{ width: size, height: size, padding: Math.max(size * 0.1, 3) }}
    />
  );
}
