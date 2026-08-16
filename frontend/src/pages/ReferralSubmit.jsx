import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function ReferralSubmit() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", address: "", message: "", resume_url: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { nav(`/login?next=/referral/${jobId}`); return; }
    if (!user.subscription) { toast.error("Subscription required."); nav("/pricing"); return; }
    api.get(`/jobs/${jobId}`).then((r) => setJob(r.data));
    setForm((f) => ({ ...f, email: user.email }));
  }, [jobId, user]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/referrals", { job_id: jobId, ...form });
      toast.success("Referral request sent! The employee will reach out via your email.");
      nav("/profile");
    } catch (err) {
      toast.error(formatErr(err));
    } finally { setLoading(false); }
  };

  if (!job) return <div className="pt-24 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="pt-24 pb-16 max-w-2xl mx-auto px-6" data-testid="referral-submit-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4 mb-8">
          <img src={job.logo} alt="" className="w-16 h-16 rounded-xl bg-white p-2 border border-border" />
          <div>
            <div className="text-sm text-primary font-mono">{job.company}</div>
            <h1 className="font-display text-2xl font-bold tracking-tighter">Request referral · {job.role}</h1>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6 rounded-xl bg-card border border-border">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>First Name</Label>
              <Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="ref-fname-input" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="ref-lname-input" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="ref-email-input" />
          </div>
          <div>
            <Label>Address</Label>
            <Input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="ref-address-input" />
          </div>
          <div>
            <Label>Resume URL (Drive / LinkedIn / etc.)</Label>
            <Input placeholder="https://..." value={form.resume_url} onChange={(e) => setForm({ ...form, resume_url: e.target.value })} data-testid="ref-resume-input" />
          </div>
          <div>
            <Label>Message (optional)</Label>
            <Textarea rows={4} placeholder="Anything the referrer should know..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="ref-message-input" />
          </div>
          <Button type="submit" disabled={loading} className="w-full btn-lift" data-testid="ref-submit-btn">
            {loading ? "Sending..." : "Send referral request"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
