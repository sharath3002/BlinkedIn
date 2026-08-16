import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const FEATURES = ["Unlimited job applications", "Unlimited referral requests", "Priority job alerts", "Priority support"];

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(null);
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const highlight = params.get("plan");

  useEffect(() => {
    api.get("/subscription/plans?kind=job").then((r) => setPlans(r.data));
  }, []);

  const checkout = async (key) => {
    if (!user) { nav(`/login?next=/pricing`); return; }
    setLoading(key);
    try {
      const { data } = await api.post("/payments/checkout", { lookup_key: key, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatErr(e));
      setLoading(null);
    }
  };

  return (
    <div className="pt-24 pb-20 max-w-6xl mx-auto px-6" data-testid="pricing-page">
      <div className="text-center mb-14">
        <div className="text-xs uppercase tracking-widest text-primary font-bold">Pricing</div>
        <h1 className="font-display text-5xl font-bold tracking-tighter mt-2">Simple, transparent plans</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Free forever with 10 applications. Unlock unlimited access + referrals with any paid plan.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {plans.map((p, i) => {
          const isMid = i === 1;
          const isHighlight = highlight === p.lookup_key;
          return (
            <motion.div
              key={p.lookup_key}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`relative p-8 rounded-2xl border ${isMid ? "border-primary bg-primary/5" : "border-border bg-card"} ${isHighlight ? "ring-2 ring-primary" : ""}`}
              data-testid={`plan-card-${p.lookup_key}`}
            >
              {isMid && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-white text-xs font-semibold">Most popular</div>}
              <div className="text-sm text-muted-foreground">{p.name}</div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="font-display text-5xl font-bold tracking-tighter">₹{p.amount / 100}</span>
                <span className="text-muted-foreground text-sm">/{p.months === 1 ? "month" : `${p.months}mo`}</span>
              </div>
              <ul className="mt-6 space-y-2.5">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6 btn-lift"
                variant={isMid ? "default" : "outline"}
                disabled={loading === p.lookup_key}
                onClick={() => checkout(p.lookup_key)}
                data-testid={`subscribe-btn-${p.lookup_key}`}
              >
                {loading === p.lookup_key ? "Redirecting..." : "Subscribe"}
              </Button>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Payments powered by Stripe · Test card: 4242 4242 4242 4242 · any future expiry
      </p>
    </div>
  );
}
