import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import Leaderboard from "@/components/Leaderboard";

export default function ReferATalent() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    first_name: "", last_name: "", dob: "", email: "", address: "",
    company: "", govt_id: "", company_id: "", bank_account: "",
    ifsc: "", branch: "", upi: "", resume_url: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, email: user.email }));
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) { nav("/login?next=/refer-a-talent"); return; }
    setLoading(true);
    try {
      await api.post("/employees/register", form);
      toast.success("Application submitted! Admin will verify within 24-48 hours.");
      await refresh();
      nav("/employee-dashboard");
    } catch (err) { toast.error(formatErr(err)); }
    finally { setLoading(false); }
  };

  if (user?.is_employee) {
    return (
      <div className="pt-24 pb-16 max-w-2xl mx-auto px-6 text-center" data-testid="refer-talent-already">
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
        <h1 className="font-display text-3xl font-bold tracking-tighter">You're registered as a referrer</h1>
        <p className="text-muted-foreground mt-2">
          Status: {user.employee_verified ? "Verified ✓" : "Pending admin verification"}
        </p>
        <Button className="mt-6" onClick={() => nav("/employee-dashboard")} data-testid="go-emp-dash-btn">Go to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 max-w-6xl mx-auto px-6" data-testid="refer-talent-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs uppercase tracking-widest text-primary font-bold">For employees & HRs</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Refer talent, earn rewards</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          Register with your company. Once verified, you'll see referral requests for your organization.
          Earn $10 for every 50 referrals, $10 per 20 interview-mails, $10 per 2 offer-letters — stackable.
        </p>

        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            <form onSubmit={submit} className="space-y-4 p-6 rounded-xl bg-card border border-border">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>First name *</Label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="emp-fname" /></div>
                <div><Label>Last name *</Label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="emp-lname" /></div>
                <div><Label>Date of Birth *</Label><Input type="date" required value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} data-testid="emp-dob" /></div>
                <div><Label>Email *</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="emp-email" /></div>
                <div className="sm:col-span-2"><Label>Address *</Label><Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="emp-address" /></div>
                <div><Label>Company (working) *</Label><Input required placeholder="e.g. Google" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} data-testid="emp-company" /></div>
                <div><Label>Resume URL</Label><Input placeholder="https://..." value={form.resume_url} onChange={(e) => setForm({ ...form, resume_url: e.target.value })} data-testid="emp-resume" /></div>
                <div><Label>Govt ID URL</Label><Input placeholder="https://..." value={form.govt_id} onChange={(e) => setForm({ ...form, govt_id: e.target.value })} data-testid="emp-govtid" /></div>
                <div><Label>Company ID URL</Label><Input placeholder="https://..." value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} data-testid="emp-companyid" /></div>
                <div><Label>Bank Account *</Label><Input required value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} data-testid="emp-bank" /></div>
                <div><Label>IFSC *</Label><Input required value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} data-testid="emp-ifsc" /></div>
                <div><Label>Branch *</Label><Input required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} data-testid="emp-branch" /></div>
                <div><Label>UPI ID</Label><Input placeholder="name@bank" value={form.upi} onChange={(e) => setForm({ ...form, upi: e.target.value })} data-testid="emp-upi" /></div>
              </div>
              <Button type="submit" disabled={loading} className="w-full btn-lift" data-testid="emp-submit-btn">
                {loading ? "Submitting..." : "Submit for verification"}
              </Button>
            </form>
          </div>
          <div>
            <Leaderboard testid="refer-talent-leaderboard" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
