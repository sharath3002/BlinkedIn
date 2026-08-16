import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cpu, Zap, Shield, Check, Code, Network, Copy, ArrowRight,
  Package, Search, MapPin, Briefcase, ExternalLink, RefreshCw, Bot
} from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { LogoMark } from "@/lib/brand";
import CompanyLogo from "@/components/CompanyLogo";

function AIWorkflow() {
  const steps = [
    { icon: Network, label: "URL added", body: "Admin/customer adds a career URL" },
    { icon: Bot, label: "Agent spins up", body: "Persistent agent runs every 5 min" },
    { icon: Cpu, label: "Claude extracts", body: "Roles, location, exp normalized" },
    { icon: Zap, label: "Streams to feed", body: "Live JSON delivered via API/embed" },
  ];
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap my-8">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}
            className="w-40 p-4 rounded-xl bg-card border border-border text-center node-pulse">
            <s.icon className="w-6 h-6 mx-auto text-primary mb-2" />
            <div className="font-semibold text-sm">{s.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.body}</div>
          </motion.div>
          {i < steps.length - 1 && <ArrowRight className="w-5 h-5 text-primary hidden md:block" />}
        </div>
      ))}
    </div>
  );
}

// Mock embedded widget preview — shows how customer's website would look
function EmbeddedWidgetPreview() {
  const mockJobs = [
    { company: "Google", role: "Senior Software Engineer", location: "Bangalore, IN", exp: "5-8 yrs", domain: "google.com" },
    { company: "Amazon", role: "Data Scientist", location: "Hyderabad, IN", exp: "3-6 yrs", domain: "amazon.com" },
    { company: "Microsoft", role: "Cloud Architect", location: "Remote", exp: "7-10 yrs", domain: "microsoft.com" },
    { company: "Meta", role: "ML Engineer", location: "London, UK", exp: "4-7 yrs", domain: "meta.com" },
  ];
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
      className="rounded-2xl bg-white overflow-hidden border-2 border-primary/40 shadow-2xl max-w-2xl mx-auto"
      data-testid="embed-preview">
      {/* Browser chrome */}
      <div className="bg-gray-100 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
        </div>
        <div className="flex-1 text-center">
          <div className="inline-block bg-white px-3 py-1 rounded-md text-xs text-gray-500 font-mono">yourcompany.com/careers</div>
        </div>
      </div>
      {/* Customer page mock */}
      <div className="bg-white p-6 text-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-bold text-xl text-gray-900">YourCompany · Careers</div>
          <div className="w-8 h-8 rounded-full bg-gray-100"></div>
        </div>
        <div className="mb-4 flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <div className="pl-8 pr-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-400">Search roles...</div>
          </div>
          <div className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-500">Location</div>
          <div className="px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-500">Filter</div>
        </div>
        <div className="space-y-2">
          {mockJobs.map((j) => (
            <div key={j.company} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors">
              <CompanyLogo company={j.company} src={`https://logo.clearbit.com/${j.domain}`} size={36} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{j.role}</div>
                <div className="text-xs text-gray-500 flex gap-2">
                  <span>{j.company}</span>
                  <span>·</span>
                  <span>{j.location}</span>
                  <span>·</span>
                  <span>{j.exp}</span>
                </div>
              </div>
              <button className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold">Apply</button>
            </div>
          ))}
        </div>
        {/* BlinkedIn watermark */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-1.5 text-xs text-gray-400">
          <span>Powered by</span>
          <LogoMark size={16} />
          <span className="font-semibold text-gray-500">Blinked<span style={{ color: "#5B4FFF" }}>In</span></span>
        </div>
      </div>
    </motion.div>
  );
}

function IntegrationCode() {
  const codeEmbed = `<!-- 1. Drop this into your careers page -->
<div id="blinkedin-jobs"></div>
<script src="https://blinkedin.co/embed.js"
        data-api-key="bli_YOUR_KEY_HERE"></script>`;
  const codeApi = `curl -H "Authorization: Bearer bli_YOUR_KEY" \\
     https://api.blinkedin.co/v1/embed/jobs?page=1&limit=20

# Response:
# {
#   "jobs": [{ role, company, location, experience, apply_url, ... }],
#   "total": 257, "page": 1, "pages": 13,
#   "watermark_url": "..."
# }`;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Embed widget (drop-in)</span>
        </div>
        <pre className="text-[10px] font-mono text-muted-foreground bg-muted p-3 rounded-md overflow-x-auto whitespace-pre">{codeEmbed}</pre>
      </div>
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">REST API (build your own UI)</span>
        </div>
        <pre className="text-[10px] font-mono text-muted-foreground bg-muted p-3 rounded-md overflow-x-auto whitespace-pre">{codeApi}</pre>
      </div>
    </div>
  );
}

export default function AIAgent() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    api.get("/subscription/plans?kind=ai").then((r) => setPlans(r.data));
  }, []);

  const checkout = async (key) => {
    if (!user) { nav("/login?next=/ai-agent"); return; }
    setLoading(key);
    try {
      const { data } = await api.post("/payments/checkout", { lookup_key: key, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatErr(e));
      setLoading(null);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(user?.ai_subscription?.api_key || "");
    toast.success("API key copied");
  };

  return (
    <div className="pt-24 pb-16" data-testid="ai-agent-page">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-10 relative">
        <div className="glow-blob w-[500px] h-[500px] bg-primary/30 -top-40 -left-40" />
        <div className="glow-blob w-[400px] h-[400px] bg-lime/20 top-20 right-0" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime/20 border border-lime/40 text-xs mb-4">
            <Cpu className="w-3 h-3 text-lime" />
            <span className="font-mono font-medium">BlinkedIn AI Agents · Full software rental</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tighter max-w-3xl">
            Rent our <span className="text-primary">jobs software</span>,<br />
            keep your <span className="text-lime">users</span>.
          </h1>
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl">
            Give us a career URL — our AI agents crawl it, extract new postings, and stream them to your website. New companies we add automatically appear on your integration too.
            Only the job feed UI is shared; user actions (clicks, apply) stay on your side.
          </p>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
            Bonus: your integration displays a small "Powered by BlinkedIn" watermark.
          </p>
        </div>
      </section>

      {/* What you get + What we keep */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/30" data-testid="what-you-get">
            <div className="text-xs uppercase tracking-widest text-primary font-bold mb-3">What customers get</div>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />Live jobs feed (role, company, location, experience) — always fresh</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />Search + location + filter UI, or raw JSON via API</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />Every new career URL BlinkedIn adds → auto-syncs to your feed</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />"Apply" button routes to source (your rules, no 10-app limit)</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />You track your own analytics — we don't see clicks</li>
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border" data-testid="what-you-dont-get">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">What stays on BlinkedIn</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Shield className="w-4 h-4 shrink-0 mt-0.5" />Referrals system (only BlinkedIn users)</li>
              <li className="flex gap-2"><Shield className="w-4 h-4 shrink-0 mt-0.5" />Employee earnings + withdrawal</li>
              <li className="flex gap-2"><Shield className="w-4 h-4 shrink-0 mt-0.5" />Free-tier limits (10-app cap is our concern, not yours)</li>
              <li className="flex gap-2"><Shield className="w-4 h-4 shrink-0 mt-0.5" />User accounts / cookies on BlinkedIn.co</li>
              <li className="flex gap-2"><Shield className="w-4 h-4 shrink-0 mt-0.5" />Payment flow (all on BlinkedIn.co)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="max-w-6xl mx-auto px-6 py-8 text-center">
        <div className="text-xs uppercase tracking-widest text-primary font-bold">Under the hood</div>
        <h2 className="font-display text-3xl font-semibold mt-2 tracking-tight">How AI agents work</h2>
        <AIWorkflow />
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Powered by Claude Sonnet 4.5. Every agent is persistent — once running,
          it keeps re-checking its career URL every 5 minutes for new roles, until admin pauses it.
        </p>
      </section>

      {/* Embed preview */}
      <section className="max-w-6xl mx-auto px-6 py-16" data-testid="embed-preview-section">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-lime font-bold">Preview</div>
          <h2 className="font-display text-3xl font-semibold mt-2 tracking-tight">This is what your customers see</h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto mt-2">
            The embed drops onto any careers page. Matches your site's look with theme options; the "Powered by BlinkedIn" watermark stays.
          </p>
        </div>
        <EmbeddedWidgetPreview />
      </section>

      {/* Integration code */}
      <section className="max-w-6xl mx-auto px-6 py-12" data-testid="integration-code-section">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest text-primary font-bold">Two ways to integrate</div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Both included in one subscription</h2>
        </div>
        <IntegrationCode />
      </section>

      {/* Current subscription */}
      {user?.ai_subscription && (
        <section className="max-w-4xl mx-auto px-6 py-8" data-testid="ai-sub-active">
          <div className="p-6 rounded-2xl bg-primary/10 border-2 border-primary/40">
            <div className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Your active subscription</div>
            <div className="text-sm text-muted-foreground mb-3">
              Expires <strong>{new Date(user.ai_subscription.expires_at).toLocaleDateString()}</strong>. Access is auto-revoked on this date.
            </div>
            <div className="p-3 rounded-lg bg-card border border-border font-mono text-xs flex items-center gap-3">
              <span className="text-muted-foreground shrink-0">API_KEY:</span>
              <code className="flex-1 truncate">{user.ai_subscription.api_key}</code>
              <Button size="sm" variant="outline" onClick={copyKey} data-testid="copy-api-key-btn">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-primary font-bold">Pricing</div>
          <h2 className="font-display text-3xl font-semibold mt-2 tracking-tight">One subscription, both integrations</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {plans.map((p, i) => {
            const isYearly = p.months === 12;
            return (
              <motion.div key={p.lookup_key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`p-8 rounded-2xl border-2 ${isYearly ? "border-lime bg-lime/5" : "border-border bg-card"} relative`}
                data-testid={`ai-plan-${p.lookup_key}`}>
                {isYearly && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-lime text-black text-xs font-semibold">Save ₹4989</div>}
                <div className="text-sm text-muted-foreground">{p.name}</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="font-display text-5xl font-bold tracking-tighter">₹{p.amount / 100}</span>
                  <span className="text-muted-foreground text-sm">/{p.months === 1 ? "month" : "year"}</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm">
                  {["Full embed widget", "REST API access", "1000+ career sites", "New URLs auto-sync to you", "Cancel anytime · Auto-expire"].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6 btn-lift" variant={isYearly ? "default" : "outline"}
                  disabled={loading === p.lookup_key} onClick={() => checkout(p.lookup_key)}
                  data-testid={`ai-subscribe-btn-${p.lookup_key}`}>
                  {loading === p.lookup_key ? "Redirecting..." : "Get API access"}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Trust */}
      <section className="max-w-4xl mx-auto px-6 py-8 text-center">
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Shield, label: "Secure", body: "TLS + key rotation on renewal" },
            { icon: Zap, label: "Fast", body: "P95 < 200ms responses" },
            { icon: RefreshCw, label: "Auto-updating", body: "New career sites propagate for free" },
          ].map((s) => (
            <div key={s.label} className="p-4">
              <s.icon className="w-5 h-5 mx-auto text-primary mb-2" />
              <div className="font-semibold text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
