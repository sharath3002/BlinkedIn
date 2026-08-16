import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, MessageSquare, CreditCard, DollarSign,
  LogIn, Link2, CheckCircle2, XCircle, Sparkles, Search, RefreshCw, Cpu, ExternalLink,
  Bot, PauseCircle, PlayCircle, Key, Wand2, Trash2, Zap, Copy
} from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { LogoMark } from "@/lib/brand";
import CompanyLogo from "@/components/CompanyLogo";
import AgentTrainer from "@/components/AgentTrainer";

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "agents", label: "AI Agents", icon: Bot },
  { key: "api_customers", label: "API Customers", icon: Key },
  { key: "mock_api", label: "Mock API", icon: Zap },
  { key: "employees", label: "Employees", icon: Users },
  { key: "referrals", label: "Referrals", icon: Sparkles },
  { key: "withdrawals", label: "Withdrawals", icon: DollarSign },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "contact", label: "Feedback", icon: MessageSquare },
  { key: "logins", label: "Logins", icon: LogIn },
  { key: "job_urls", label: "Job URLs", icon: Link2 },
];

function StatCard({ label, value, sub, testid }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-xl bg-card border border-border card-hover" data-testid={testid}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
      <div className="text-3xl font-display font-bold tracking-tighter mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </motion.div>
  );
}

function Section({ title, subtitle, children, right }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [section, setSection] = useState("overview");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState(null);
  const [data, setData] = useState({ employees: [], referrals: [], withdrawals: [], payments: [], contact: [], logins: [], job_urls: [], agents: [], api_customers: [] });
  const [newUrl, setNewUrl] = useState({ company: "", url: "", logo: "", location_filter: "", recent_only: true });
  const [trainingAgentId, setTrainingAgentId] = useState(null);
  const [mockApi, setMockApi] = useState(null);
  const [mockUsage, setMockUsage] = useState([]);

  const loadMockApi = useCallback(async () => {
    try {
      const [m, u] = await Promise.all([api.get("/admin/mock-api"), api.get("/admin/mock-api/usage")]);
      setMockApi(m.data); setMockUsage(u.data);
    } catch { /* silent */ }
  }, []);

  const toggleMockApi = async (enabled) => {
    try {
      await api.post("/admin/mock-api/toggle", { enabled });
      toast.success(enabled ? "Mock API is now ON" : "Mock API is now OFF");
      loadMockApi();
    } catch (err) { toast.error(formatErr(err)); }
  };

  const copyText = (text, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const loadAll = useCallback(async () => {
    try {
      const [s, e, r, w, p, c, l, ju, ag, ac] = await Promise.all([
        api.get("/admin/stats"), api.get("/admin/employees"), api.get("/admin/referrals"),
        api.get("/admin/withdrawals"), api.get("/admin/payments"), api.get("/admin/contact"),
        api.get("/admin/logins"), api.get("/admin/job-urls"),
        api.get("/admin/agents"), api.get("/admin/api-customers"),
      ]);
      setStats(s.data);
      setData({
        employees: e.data, referrals: r.data, withdrawals: w.data, payments: p.data,
        contact: c.data, logins: l.data, job_urls: ju.data,
        agents: ag.data, api_customers: ac.data,
      });
    } catch (err) { toast.error(formatErr(err)); }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav("/login"); return; }
    if (user.role !== "admin") { nav("/"); return; }
    loadAll();
    loadMockApi();
  }, [user, loading, nav, loadAll, loadMockApi]);

  const verifyEmp = async (id) => { await api.post(`/admin/employees/${id}/verify`); toast.success("Employee verified"); loadAll(); };
  const rejectEmp = async (id) => { await api.post(`/admin/employees/${id}/reject`); toast.success("Employee rejected"); loadAll(); };
  const approveWd = async (id) => { await api.post(`/admin/withdrawals/${id}/approve`); toast.success("Withdrawal approved & user emailed"); loadAll(); };
  const verifyProof = async (refId, type) => {
    await api.post(`/admin/referrals/${refId}/verify-proof?proof_type=${type}`);
    toast.success("Proof verified — reward calculated");
    loadAll();
  };
  const addUrl = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/job-urls", newUrl);
      toast.success("URL added");
      setNewUrl({ company: "", url: "", logo: "", location_filter: "", recent_only: true });
      loadAll();
    } catch (err) { toast.error(formatErr(err)); }
  };
  const fetchUrl = async (id, mode = "fetch") => {
    const endpoint = mode === "ai" ? `/admin/job-urls/${id}/ai-scrape` : `/admin/job-urls/${id}/fetch`;
    toast.loading(mode === "ai" ? "AI agent working..." : "Fetching...", { id: "scrape" });
    try {
      const { data } = await api.post(endpoint);
      toast.success(`Added ${data.added} jobs${data.mode ? ` (${data.mode})` : ""}`, { id: "scrape" });
      loadAll();
    } catch (err) { toast.error(formatErr(err), { id: "scrape" }); }
  };
  const pauseAgent = async (id) => { await api.post(`/admin/agents/${id}/pause`); toast.success("Agent paused"); loadAll(); };
  const startAgent = async (id) => { await api.post(`/admin/agents/${id}/start`); toast.success("Agent resumed"); loadAll(); };
  const runAgent = async (id) => {
    toast.loading("Running agent...", { id: "run" });
    try { const { data } = await api.post(`/admin/agents/${id}/run-now`); toast.success(`Added ${data.added} jobs`, { id: "run" }); loadAll(); }
    catch (err) { toast.error(formatErr(err), { id: "run" }); }
  };
  const deleteAgent = async (id, company) => {
    const purge = window.confirm(`Delete agent for "${company}"?\n\nClick OK to also delete jobs it created, Cancel to keep them.`);
    // window.confirm returns true=OK, false=Cancel — but user might have hit "X". We treat OK as "purge=true".
    // To let admin delete WITHOUT purging jobs, use the destructive button path.
    try {
      await api.delete(`/admin/agents/${id}?purge_jobs=${purge}`);
      toast.success(`Agent deleted${purge ? " (jobs purged)" : ""}`);
      loadAll();
    } catch (err) { toast.error(formatErr(err)); }
  };

  if (!stats) return <div className="pt-24 text-center text-muted-foreground">Loading admin...</div>;

  const filterFn = (item, keys) => !q || keys.some((k) => String(item[k] ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="pt-16 min-h-screen bg-background flex" data-testid="admin-page">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/40 h-[calc(100vh-4rem)] sticky top-16 hidden md:block">
        <div className="p-5 border-b border-border flex items-center gap-2.5">
          <LogoMark size={28} />
          <div>
            <div className="font-display font-bold tracking-tighter text-sm">BlinkedIn</div>
            <div className="text-[10px] uppercase tracking-widest text-primary">Admin</div>
          </div>
        </div>
        <nav className="p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                section === s.key ? "bg-primary text-white" : "hover:bg-muted text-foreground/80"
              }`}
              data-testid={`admin-nav-${s.key}`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
              {s.key === "employees" && stats.pending_employees > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono bg-lime text-black">{stats.pending_employees}</span>
              )}
              {s.key === "withdrawals" && stats.pending_withdrawals > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-mono bg-lime text-black">{stats.pending_withdrawals}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 mt-6 mx-2 rounded-xl bg-primary/5 border border-primary/20">
          <div className="text-xs text-muted-foreground">Live revenue</div>
          <div className="font-display font-bold text-2xl text-primary">₹{stats.revenue.toFixed(0)}</div>
        </div>
      </aside>

      {/* Mobile section switcher */}
      <div className="md:hidden fixed top-16 left-0 right-0 z-40 bg-background border-b border-border overflow-x-auto">
        <div className="flex gap-1 p-2">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium shrink-0 ${section === s.key ? "bg-primary text-white" : "bg-muted"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 p-6 md:p-10 mt-14 md:mt-0">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-bold">Control Center</div>
            <h1 className="font-display text-3xl font-bold tracking-tighter">{SECTIONS.find((s) => s.key === section)?.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            {section !== "overview" && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="pl-9 w-52" data-testid="admin-search" />
              </div>
            )}
            <Button size="sm" variant="outline" onClick={loadAll} data-testid="admin-refresh"><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {section === "overview" && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Total users" value={stats.users} testid="admin-stat-users" />
                  <StatCard label="Active (24h)" value={stats.active_users_24h} sub="Unique logins" testid="admin-stat-active" />
                  <StatCard label="Jobs live" value={stats.jobs} sub="Feed size" testid="admin-stat-jobs" />
                  <StatCard label="Applications" value={stats.applications} sub="Deduped by user + role" testid="admin-stat-apps" />
                  <StatCard label="Jobs subscribers" value={stats.subscribers} testid="admin-stat-subs" />
                  <StatCard label="AI subscribers" value={stats.ai_subscribers} sub="API renters" testid="admin-stat-aisubs" />
                  <StatCard label="Referrals" value={stats.referrals} testid="admin-stat-refs" />
                  <StatCard label="Revenue" value={`₹${stats.revenue.toFixed(0)}`} sub="Lifetime paid" testid="admin-stat-rev" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-xl bg-card border border-border">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Action needed</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-lime" /> {stats.pending_employees} employees awaiting verification</li>
                      <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-lime" /> {stats.pending_withdrawals} withdrawal requests pending</li>
                    </ul>
                  </div>
                  <div className="p-6 rounded-xl bg-primary/5 border border-primary/30">
                    <Cpu className="w-5 h-5 text-primary mb-2" />
                    <div className="font-semibold">AI Agents API</div>
                    <div className="text-sm text-muted-foreground">Rent our scraping agents by month or year. Track subscribers here.</div>
                  </div>
                </div>
              </>
            )}

            {section === "employees" && (
              <Section title="Employee verifications" subtitle="Verify identity + company details before granting referral privileges">
                <div className="space-y-2">
                  {data.employees.filter((e) => filterFn(e, ["email", "employee_company", "employee_first_name"])).map((e) => (
                    <div key={e.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 flex-wrap" data-testid={`emp-row-${e.id}`}>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {(e.employee_first_name || e.name || "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{e.employee_first_name} {e.employee_last_name} · {e.employee_company}</div>
                        <div className="text-xs text-muted-foreground">{e.email} · UPI: {e.employee_upi || "-"} · Bank: {e.employee_bank || "-"}</div>
                      </div>
                      <div className={`text-xs font-mono px-2 py-1 rounded ${e.employee_verified ? "bg-primary/20 text-primary" : "bg-lime/30 text-lime"}`}>
                        {e.employee_verified ? "✓ verified" : "pending"}
                      </div>
                      {!e.employee_verified && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => verifyEmp(e.id)} data-testid={`verify-emp-${e.id}`}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="outline" onClick={() => rejectEmp(e.id)} data-testid={`reject-emp-${e.id}`}><XCircle className="w-3.5 h-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {section === "referrals" && (
              <Section title="Referral requests & proofs" subtitle="Verify proof documents to auto-reward the referring employee">
                <div className="space-y-2">
                  {data.referrals.filter((r) => filterFn(r, ["email", "company", "role", "first_name", "last_name"])).map((r) => (
                    <div key={r.id} className="p-4 rounded-xl bg-card border border-border">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="font-semibold">{r.first_name} {r.last_name} → {r.company} <span className="text-muted-foreground">({r.role})</span></div>
                          <div className="text-xs text-muted-foreground">{r.email} · by {r.user_email}</div>
                        </div>
                        <div className="text-xs font-mono px-2 py-1 rounded bg-muted">{r.status}</div>
                      </div>
                      {r.proofs?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {r.proofs.map((p, i) => (
                            <div key={`${r.id}-${p.type}-${i}`} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted">
                              <span className="font-mono w-20">{p.type}</span>
                              <a href={p.url} target="_blank" rel="noreferrer" className="text-primary underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />view</a>
                              <div className="flex-1" />
                              {p.verified ? <span className="text-lime">✓ verified</span> : (
                                <Button size="sm" variant="outline" onClick={() => verifyProof(r.id, p.type)} data-testid={`verify-proof-${r.id}-${p.type}`}>
                                  Verify & reward
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {section === "withdrawals" && (
              <Section title="Withdrawal requests" subtitle="Approve = user gets confirmation email">
                <div className="space-y-2">
                  {data.withdrawals.filter((w) => filterFn(w, ["email", "status"])).map((w) => (
                    <div key={w.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4" data-testid={`wd-row-${w.id}`}>
                      <div className="w-10 h-10 rounded-lg bg-lime/20 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-lime" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{w.email} — ${w.amount}</div>
                        <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                      </div>
                      <div className={`text-xs font-mono px-2 py-1 rounded ${w.status === "paid" ? "bg-primary/20 text-primary" : "bg-muted"}`}>{w.status}</div>
                      {w.status === "pending" && <Button size="sm" onClick={() => approveWd(w.id)} data-testid={`approve-wd-${w.id}`}>Mark paid</Button>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {section === "payments" && (
              <Section title="Payment transactions" subtitle="Every Stripe checkout attempt is logged here">
                <div className="space-y-2">
                  {data.payments.filter((p) => filterFn(p, ["email", "lookup_key"])).map((p) => (
                    <div key={p.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 flex-wrap" data-testid={`pay-row-${p.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{p.email}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">{p.session_id}</div>
                      </div>
                      <div className="text-sm font-mono">₹{p.amount / 100}</div>
                      <div className="text-xs px-2 py-1 rounded bg-muted font-mono">{p.lookup_key}</div>
                      <div className={`text-xs font-mono px-2 py-1 rounded ${p.payment_status === "paid" ? "bg-primary/20 text-primary" : "bg-muted"}`}>{p.payment_status}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {section === "contact" && (
              <Section title="Contact form messages" subtitle="Auto-reply already sent to submitter">
                <div className="space-y-2">
                  {data.contact.filter((c) => filterFn(c, ["email", "name", "subject"])).map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-card border border-border" data-testid={`contact-row-${c.id}`}>
                      <div className="font-semibold">{c.subject}</div>
                      <div className="text-xs text-muted-foreground">{c.name} · {c.email} · {new Date(c.created_at).toLocaleString()}</div>
                      <div className="text-sm mt-2 whitespace-pre-wrap">{c.message}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {section === "logins" && (
              <Section title="Recent login sessions">
                <div className="space-y-1">
                  {data.logins.filter((l) => filterFn(l, ["email", "ip"])).map((l) => (
                    <div key={l.id} className="p-3 rounded-lg bg-card border border-border text-sm flex items-center gap-3" data-testid={`login-row-${l.id}`}>
                      <LogIn className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                      <span className="font-semibold">{l.email}</span>
                      <span className="text-xs text-muted-foreground font-mono ml-auto">{l.ip || "-"}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {section === "agents" && (
              <Section title="AI Agents · live status" subtitle="Every added career URL runs a persistent agent that re-scrapes every 5 minutes">
                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Running</div>
                    <div className="text-2xl font-display font-bold text-primary">{data.agents.filter((a) => a.status === "running").length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Paused</div>
                    <div className="text-2xl font-display font-bold">{data.agents.filter((a) => a.status === "paused").length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Total jobs found</div>
                    <div className="text-2xl font-display font-bold text-lime">{data.agents.reduce((sum, a) => sum + (a.total_jobs_found || 0), 0)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.agents.filter((a) => filterFn(a, ["company", "url"])).map((a) => (
                    <div key={a.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 flex-wrap" data-testid={`agent-row-${a.id}`}>
                      <CompanyLogo company={a.company} src={a.logo} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold flex items-center gap-2">
                          {a.company}
                          {a.training_notes && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime/20 text-lime border border-lime/40 font-mono font-medium"
                              title={a.training_notes}
                              data-testid={`agent-notes-badge-${a.id}`}
                            >
                              trained ✧
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{a.url}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Runs: {a.run_count || 0} · Jobs found: {a.total_jobs_found || 0}
                          {a.last_run_at && <> · Last: {new Date(a.last_run_at).toLocaleTimeString()}</>}
                        </div>
                        {a.training_notes && (
                          <div className="text-[11px] text-muted-foreground/80 mt-1 italic truncate" data-testid={`agent-notes-text-${a.id}`}>
                            📝 {a.training_notes}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className={`text-xs font-mono px-2 py-1 rounded ${
                          a.status === "running" ? "bg-primary/20 text-primary" :
                          a.status === "paused" ? "bg-muted" : "bg-destructive/20 text-destructive"
                        }`}>{a.status}</div>
                        <div className={`text-[10px] font-mono ${
                          a.health === "healthy" ? "text-lime" : a.health === "degraded" ? "text-yellow-500" : "text-destructive"
                        }`}>● {a.health}</div>
                      </div>
                      <div className="flex gap-1">
                        {a.status === "running" ? (
                          <Button size="sm" variant="outline" onClick={() => pauseAgent(a.id)} data-testid={`pause-agent-${a.id}`}>
                            <PauseCircle className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => startAgent(a.id)} data-testid={`start-agent-${a.id}`}>
                            <PlayCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => runAgent(a.id)} data-testid={`run-agent-${a.id}`}>
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => setTrainingAgentId(a.id)} data-testid={`train-agent-${a.id}`}>
                          <Wand2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteAgent(a.id, a.company)} data-testid={`delete-agent-${a.id}`} title="Delete agent">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {data.agents.length === 0 && (
                    <div className="p-8 rounded-xl bg-muted text-center text-muted-foreground">
                      No agents yet. Add a career URL in "Job URLs" to spin one up.
                    </div>
                  )}
                </div>
              </Section>
            )}

            {section === "mock_api" && (
              <Section title="Mock API integration" subtitle="Ship a live demo of BlinkedIn on any website. Toggle it on, hand out the code, flip it off when done — no subscription required.">
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  <div className="p-5 rounded-xl bg-card border border-border" data-testid="mock-api-status-card">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Status</div>
                    <div className={`mt-2 text-2xl font-display font-bold tracking-tighter flex items-center gap-2 ${mockApi?.enabled ? "text-lime" : "text-muted-foreground"}`}>
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${mockApi?.enabled ? "bg-lime animate-pulse" : "bg-muted-foreground/60"}`} />
                      {mockApi?.enabled ? "LIVE" : "OFF"}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => toggleMockApi(true)} disabled={mockApi?.enabled} data-testid="mock-api-on">
                        <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> Turn ON
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleMockApi(false)} disabled={!mockApi?.enabled} data-testid="mock-api-off">
                        <PauseCircle className="w-3.5 h-3.5 mr-1.5" /> Turn OFF
                      </Button>
                    </div>
                  </div>
                  <div className="p-5 rounded-xl bg-card border border-border">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Total calls</div>
                    <div className="text-3xl font-display font-bold tracking-tighter mt-2">{mockApi?.usage_count || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Since the mock was first enabled</div>
                  </div>
                  <div className="p-5 rounded-xl bg-primary/5 border border-primary/30">
                    <div className="text-xs uppercase tracking-widest text-primary font-bold">Last change</div>
                    <div className="text-sm mt-2 font-medium">
                      {mockApi?.updated_at ? new Date(mockApi.updated_at).toLocaleString() : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">By {mockApi?.updated_by || "system"}</div>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-card border border-border" data-testid="mock-api-key-block">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Demo API key</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${mockApi?.enabled ? "bg-lime/20 text-lime" : "bg-muted text-muted-foreground"}`}>
                      {mockApi?.enabled ? "accepting requests" : "requests will 403"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted font-mono text-xs">
                    <code className="flex-1 truncate">{mockApi?.key || "—"}</code>
                    <Button size="sm" variant="outline" onClick={() => copyText(mockApi?.key || "", "API key copied")} data-testid="mock-api-copy-key">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Anyone with this key can hit <code className="text-primary">/api/embed/jobs</code> and <code className="text-primary">/api/embed/companies</code> without a subscription — but only while the toggle above is ON.
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="p-5 rounded-xl bg-card border border-border">
                    <div className="text-xs uppercase tracking-widest text-primary font-bold mb-3">1. curl (test in a terminal)</div>
                    <pre className="text-[11px] p-3 rounded-lg bg-muted overflow-x-auto font-mono" data-testid="mock-snippet-curl"><code>{`curl "${process.env.REACT_APP_BACKEND_URL}/api/embed/jobs?limit=5" \\
  -H "Authorization: Bearer ${mockApi?.key || "<KEY>"}"`}</code></pre>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => copyText(`curl "${process.env.REACT_APP_BACKEND_URL}/api/embed/jobs?limit=5" -H "Authorization: Bearer ${mockApi?.key || ""}"`, "curl command copied")} data-testid="copy-curl">
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                  </div>

                  <div className="p-5 rounded-xl bg-card border border-border">
                    <div className="text-xs uppercase tracking-widest text-primary font-bold mb-3">2. JavaScript (drop into any site)</div>
                    <pre className="text-[11px] p-3 rounded-lg bg-muted overflow-x-auto font-mono" data-testid="mock-snippet-js"><code>{`// BlinkedIn embed — mock/demo mode
const res = await fetch(
  "${process.env.REACT_APP_BACKEND_URL}/api/embed/jobs?limit=10",
  { headers: { Authorization: "Bearer ${mockApi?.key || "<KEY>"}" } }
);
const { jobs } = await res.json();
console.log(jobs);`}</code></pre>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => copyText(`const res = await fetch("${process.env.REACT_APP_BACKEND_URL}/api/embed/jobs?limit=10", { headers: { Authorization: "Bearer ${mockApi?.key || ""}" } });\nconst { jobs } = await res.json();`, "JS snippet copied")} data-testid="copy-js">
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                  </div>

                  <div className="p-5 rounded-xl bg-card border border-border">
                    <div className="text-xs uppercase tracking-widest text-primary font-bold mb-3">3. Python</div>
                    <pre className="text-[11px] p-3 rounded-lg bg-muted overflow-x-auto font-mono" data-testid="mock-snippet-py"><code>{`import requests

r = requests.get(
    "${process.env.REACT_APP_BACKEND_URL}/api/embed/jobs",
    headers={"Authorization": "Bearer ${mockApi?.key || "<KEY>"}"},
    params={"limit": 10},
)
print(r.json())`}</code></pre>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => copyText(`import requests\nr = requests.get("${process.env.REACT_APP_BACKEND_URL}/api/embed/jobs", headers={"Authorization": "Bearer ${mockApi?.key || ""}"}, params={"limit": 10})\nprint(r.json())`, "Python snippet copied")} data-testid="copy-py">
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Recent mock calls</div>
                  {mockUsage.length === 0 ? (
                    <div className="p-6 rounded-xl bg-muted text-center text-sm text-muted-foreground">
                      No calls yet. Once the mock is ON and someone hits an <code>/api/embed/*</code> endpoint with the demo key, you'll see the traffic here.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {mockUsage.slice(0, 10).map((u) => (
                        <div key={u.id} className="p-3 rounded-lg bg-card border border-border flex items-center gap-3 text-xs font-mono" data-testid={`mock-usage-${u.id}`}>
                          <span className="text-primary">{u.endpoint}</span>
                          <span className="text-muted-foreground">→ {u.count} items</span>
                          <span className="ml-auto text-muted-foreground">{new Date(u.at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {section === "api_customers" && (
              <Section title="API Customers" subtitle="Users who bought the BlinkedIn AI Agent API / embed integration">
                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Active customers</div>
                    <div className="text-2xl font-display font-bold text-primary">{data.api_customers.length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-xs text-muted-foreground">Total API calls</div>
                    <div className="text-2xl font-display font-bold">{data.api_customers.reduce((s, c) => s + (c.usage_count || 0), 0)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border">
                    <div className="text-xs text-muted-foreground">MRR (est.)</div>
                    <div className="text-2xl font-display font-bold text-lime">
                      ₹{data.api_customers.reduce((s, c) => s + ((c.amount || 0) / (c.plan?.includes("yearly") ? 1200 : 100)), 0).toFixed(0)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.api_customers.filter((c) => filterFn(c, ["email", "name"])).map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 flex-wrap" data-testid={`api-cust-${c.id}`}>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{c.name} <span className="text-xs text-muted-foreground">· {c.email}</span></div>
                        <div className="text-xs text-muted-foreground font-mono">{c.api_key_preview}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono">₹{(c.amount || 0) / 100}</div>
                        <div className="text-xs text-muted-foreground">{c.plan}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-xs">{c.usage_count || 0} calls</div>
                        <div className="text-xs text-muted-foreground">until {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "-"}</div>
                      </div>
                    </div>
                  ))}
                  {data.api_customers.length === 0 && (
                    <div className="p-8 rounded-xl bg-muted text-center text-muted-foreground">
                      No API customers yet. Subscriptions purchased on /ai-agent appear here.
                    </div>
                  )}
                </div>
              </Section>
            )}

            {section === "job_urls" && (
              <Section title="Job URL tracker" subtitle="Add career URLs; AI agents fetch & normalize on demand">
                <form onSubmit={addUrl} className="p-4 rounded-xl bg-card border border-border grid sm:grid-cols-6 gap-2 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground">Company</label>
                    <Input placeholder="e.g. IBM" required value={newUrl.company} onChange={(e) => setNewUrl({ ...newUrl, company: e.target.value })} data-testid="ju-company-input" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground">Career URL</label>
                    <Input placeholder="https://careers.ibm.com" required value={newUrl.url} onChange={(e) => setNewUrl({ ...newUrl, url: e.target.value })} data-testid="ju-url-input" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Location filter</label>
                    <Input placeholder="e.g. Bangalore (blank = any)" value={newUrl.location_filter || ""} onChange={(e) => setNewUrl({ ...newUrl, location_filter: e.target.value })} data-testid="ju-location-input" />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <input type="checkbox" id="ju-recent" checked={newUrl.recent_only !== false} onChange={(e) => setNewUrl({ ...newUrl, recent_only: e.target.checked })} data-testid="ju-recent-checkbox" />
                    <label htmlFor="ju-recent" className="text-xs text-muted-foreground">Recent postings only</label>
                  </div>
                  <Button type="submit" data-testid="ju-add-btn">Add & track</Button>
                </form>
                <div className="space-y-2 mt-4">
                  {data.job_urls.filter((u) => filterFn(u, ["company", "url"])).map((u) => (
                    <div key={u.id} className="p-4 rounded-xl bg-card border border-border flex items-center gap-4 flex-wrap" data-testid={`ju-row-${u.id}`}>
                      <CompanyLogo company={u.company} src={u.logo} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{u.company}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.url}</div>
                      </div>
                      <div className="text-xs text-muted-foreground hidden md:block">
                        {u.last_fetched ? `Last: ${new Date(u.last_fetched).toLocaleString()}` : "Never fetched"}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => fetchUrl(u.id, "fetch")} data-testid={`fetch-url-${u.id}`}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />Quick
                        </Button>
                        <Button size="sm" onClick={() => fetchUrl(u.id, "ai")} data-testid={`ai-fetch-${u.id}`}>
                          <Cpu className="w-3.5 h-3.5 mr-1" />AI Agent
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      {trainingAgentId && (
        <AgentTrainer
          agentId={trainingAgentId}
          onClose={() => setTrainingAgentId(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
