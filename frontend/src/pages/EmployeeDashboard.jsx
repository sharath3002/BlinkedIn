import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Users, Award, ExternalLink } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [earnings, setEarnings] = useState(null);
  const [refs, setRefs] = useState([]);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!user) { nav("/login"); return; }
    if (!user.is_employee) { nav("/refer-a-talent"); return; }
    api.get("/employees/earnings").then((r) => setEarnings(r.data));
    if (user.employee_verified) api.get("/employees/referrals").then((r) => setRefs(r.data));
  }, [user]);

  const withdraw = async () => {
    const a = parseFloat(amount);
    if (!a || a < 10) { toast.error("Minimum $10"); return; }
    try {
      await api.post("/employees/withdraw", { amount: a });
      toast.success("Withdrawal requested. Admin will approve within 3-5 days.");
      setAmount("");
      api.get("/employees/earnings").then((r) => setEarnings(r.data));
    } catch (e) { toast.error(formatErr(e)); }
  };

  if (!earnings) return <div className="pt-24 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="pt-24 pb-16 max-w-6xl mx-auto px-6" data-testid="employee-dashboard-page">
      <div className="text-xs uppercase tracking-widest text-primary font-bold">Employee dashboard</div>
      <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Your referrals & earnings</h1>
      <div className="text-sm text-muted-foreground mt-2">
        Status: {earnings.verified ? <span className="text-primary font-semibold">Verified ✓</span> : <span className="text-yellow-500">Pending admin approval</span>}
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[
          { icon: DollarSign, label: "Current earnings", val: `$${earnings.current_earnings}`, sub: "Withdrawable" },
          { icon: TrendingUp, label: "Total earned", val: `$${earnings.total_earned}`, sub: "Lifetime" },
          { icon: Users, label: "Referred", val: earnings.referrals_count, sub: "→ $10 per 50" },
          { icon: Award, label: "Interviews / Offers", val: `${earnings.interview_count} / ${earnings.offer_count}`, sub: "$10 per 20 / $10 per 2" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-5 rounded-xl bg-card border border-border" data-testid={`emp-stat-${i}`}>
            <s.icon className="w-4 h-4 text-primary mb-3" />
            <div className="text-2xl font-display font-bold tracking-tighter">{s.val}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xs text-muted-foreground/70 mt-1">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Withdraw */}
      {earnings.current_earnings >= 10 && (
        <div className="mt-6 p-5 rounded-xl bg-primary/5 border border-primary/30 flex flex-col sm:flex-row items-center gap-3" data-testid="withdraw-block">
          <div className="flex-1">
            <div className="font-semibold">You have <span className="text-primary">${earnings.current_earnings}</span> available</div>
            <div className="text-xs text-muted-foreground">Min withdrawal $10. After withdrawal, current earnings reset.</div>
          </div>
          <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-[140px]" data-testid="withdraw-amount" />
          <Button onClick={withdraw} data-testid="withdraw-btn">Withdraw</Button>
        </div>
      )}

      {/* Referral list */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight mb-4">Incoming referral requests</h2>
        {!earnings.verified ? (
          <div className="p-8 rounded-xl bg-muted border border-border text-center text-muted-foreground">
            Your referral applications will appear here after admin verification.
          </div>
        ) : refs.length === 0 ? (
          <div className="p-8 rounded-xl bg-muted border border-border text-center text-muted-foreground">
            No referral requests yet. Share BlinkedInJobs with candidates!
          </div>
        ) : (
          <div className="space-y-2">
            {refs.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4" data-testid={`incoming-ref-${r.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.first_name} {r.last_name}</div>
                  <div className="text-sm text-muted-foreground">{r.role} · {r.company}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.email} · {r.address}</div>
                </div>
                {r.resume_url && <a href={r.resume_url} target="_blank" rel="noreferrer" className="text-primary text-sm flex items-center gap-1"><ExternalLink className="w-3 h-3" />Resume</a>}
                <div className="text-xs font-mono px-2 py-1 rounded bg-muted">{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
