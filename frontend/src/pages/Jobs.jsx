import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import CompanyLogo from "@/components/CompanyLogo";

export default function Jobs() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState({ jobs: [], total: 0, page: 1, pages: 1 });
  const [companies, setCompanies] = useState([]);
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get("/jobs", { params: { page, q, location, experience, limit: 15 } });
      setState(data);
    } catch (e) {
      if (e?.response?.status === 402) {
        toast.error("You have crossed the limit of free usage, Please subscribe to continue");
        nav("/pricing");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get("/companies").then((r) => setCompanies(r.data));
  }, []);

  useEffect(() => {
    if (!user) { nav("/login?next=/jobs"); return; }
    // Enforce 10-app free limit for accessing jobs page
    if (!user.subscription && (user.applications_used || 0) >= 10) {
      toast.error("You have crossed the limit of free usage, Please subscribe to continue the services");
      nav("/pricing");
      return;
    }
    load(1);
  }, [user]);

  return (
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-6" data-testid="jobs-page">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-primary font-bold">Job portal</div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter mt-2">Fresh roles, ranked by recency</h1>
        <p className="text-muted-foreground mt-2">Top 200 most recent openings from 1000+ companies.</p>
      </div>

      {/* Search & filters */}
      <div className="grid md:grid-cols-4 gap-3 mb-8">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search company or role..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="jobs-search-input" />
        </div>
        <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} data-testid="jobs-location-input" />
        <div className="flex gap-2">
          <Input placeholder="Exp (e.g. 5)" value={experience} onChange={(e) => setExperience(e.target.value)} data-testid="jobs-exp-input" />
          <Button onClick={() => load(1)} data-testid="jobs-search-btn"><Filter className="w-4 h-4 mr-2" />Filter</Button>
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-3 min-h-[400px]">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading jobs...</div>
        ) : state.jobs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No jobs found. Try clearing filters.</div>
        ) : state.jobs.map((j, i) => (
          <motion.button
            key={j.id} onClick={() => nav(`/jobs/${j.id}`)}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
            className="card-hover w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border text-left"
            data-testid={`job-listing-card-${i}`}
          >
            <CompanyLogo company={j.company} src={j.logo} size={56} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg truncate">{j.role}</div>
              <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
                <span className="font-medium text-foreground">{j.company}</span>
                <span>·</span>
                <span>{j.experience}</span>
                <span>·</span>
                <span>{j.location}</span>
              </div>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-xs font-mono text-primary">{j.type}</div>
              <div className="text-xs text-muted-foreground mt-1">{j.experience}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Pagination */}
      {state.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8" data-testid="pagination">
          <Button variant="outline" size="sm" disabled={state.page <= 1} onClick={() => load(state.page - 1)} data-testid="prev-page-btn">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-mono">Page {state.page} of {state.pages}</span>
          <Button variant="outline" size="sm" disabled={state.page >= state.pages} onClick={() => load(state.page + 1)} data-testid="next-page-btn">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Logo carousel */}
      <div className="relative overflow-hidden py-8 mt-16 border-y border-border">
        <div className="flex marquee-track gap-10 whitespace-nowrap w-max">
          {[...companies, ...companies].map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex items-center gap-3 shrink-0 opacity-80">
              <CompanyLogo company={c.name} src={c.logo} size={32} />
              <span className="font-display font-semibold text-sm">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
