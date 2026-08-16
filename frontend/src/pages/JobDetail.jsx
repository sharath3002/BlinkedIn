import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Briefcase, Clock, ExternalLink, Users } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import CompanyLogo from "@/components/CompanyLogo";

export default function JobDetail() {
  const { id } = useParams();
  const { user, refresh, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [refInfo, setRefInfo] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav(`/login?next=/jobs/${id}`); return; }
    api.get(`/jobs/${id}`).then((r) => setJob(r.data));
    api.get(`/jobs/${id}/referrer-available`).then((r) => setRefInfo(r.data));
  }, [id, user, authLoading, nav]);

  const apply = async () => {
    try {
      const { data } = await api.post(`/jobs/${id}/apply`);
      if (data.already) {
        toast.info("You've already applied for this role");
      } else {
        toast.success("Applied!");
      }
      await refresh();
      window.open(job.apply_url, "_blank");
    } catch (e) {
      if (e?.response?.status === 402) {
        toast.error(formatErr(e));
        nav("/pricing");
      } else {
        toast.error(formatErr(e));
      }
    }
  };

  const takeReferral = () => {
    if (!refInfo?.available) return;
    if (!user.subscription) {
      toast.error("Referral requires an active subscription.");
      nav("/pricing");
      return;
    }
    nav(`/referral/${id}`);
  };

  if (!job) return <div className="pt-24 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="pt-24 pb-16 max-w-4xl mx-auto px-6" data-testid="job-detail-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-6 mb-8">
        <CompanyLogo company={job.company} src={job.logo} size={96} rounded="rounded-2xl" />
        <div className="flex-1">
          <div className="text-sm text-primary font-mono">{job.company}</div>
          <h1 className="font-display text-4xl font-bold tracking-tighter mt-1">{job.role}</h1>
          <div className="flex gap-4 flex-wrap text-sm text-muted-foreground mt-3">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>
            <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{job.experience}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{job.type}</span>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-3 mb-10">
        <Button size="lg" onClick={apply} className="btn-lift" data-testid="apply-btn">
          Apply now <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
        <Button size="lg" variant="outline" disabled={!refInfo?.available} onClick={takeReferral} data-testid="take-referral-btn">
          <Users className="w-4 h-4 mr-2" />
          {refInfo?.available ? `Take Referral (${refInfo.count} available)` : "Take Referral"}
        </Button>
      </div>

      {!refInfo?.available && (
        <div className="p-4 rounded-lg bg-muted border border-border text-sm text-muted-foreground mb-8" data-testid="no-referrer-msg">
          No current referrals for this organization. You can directly apply on the website.
        </div>
      )}

      <div className="prose prose-invert max-w-none">
        <h2 className="font-display text-xl font-semibold mb-3">About the role</h2>
        <p className="text-muted-foreground">{job.description}</p>
        <h2 className="font-display text-xl font-semibold mt-6 mb-3">Requirements</h2>
        <ul className="space-y-1 text-muted-foreground">
          {(job.requirements || []).map((r) => (<li key={r}>· {r}</li>))}
        </ul>
      </div>
    </div>
  );
}
