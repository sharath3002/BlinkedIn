import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!document.cookie.includes("cookie_consent=")) {
      setShow(true);
    }
  }, []);

  const accept = async () => {
    try {
      await api.post("/cookies/consent", { accepted: true });
    } catch (err) {
      console.error("Cookie consent request failed:", err);
    }
    document.cookie = `cookie_consent=1; max-age=${60*60*24*365}; path=/`;
    setShow(false);
  };

  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[60] bg-card border border-border rounded-xl p-5 shadow-2xl" data-testid="cookie-banner">
      <div className="text-sm font-semibold mb-1">We use cookies 🍪</div>
      <p className="text-xs text-muted-foreground mb-4">
        We use cookies to keep you signed in and remember your preferences. By continuing you agree to our use of cookies.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={accept} data-testid="cookie-accept-btn">Accept all</Button>
      </div>
    </div>
  );
}
