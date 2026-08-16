import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Shield, Radio, Globe, Cpu, Sparkles, Network } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import Leaderboard from "@/components/Leaderboard";
import CompanyLogo from "@/components/CompanyLogo";

function AnimatedFlowchart() {
  return (
    <div className="relative w-full max-w-4xl mx-auto h-[420px] my-8" data-testid="flowchart-animation">
      <svg viewBox="0 0 800 420" className="w-full h-full">
        <defs>
          <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent-lime))" />
          </linearGradient>
        </defs>
        <path d="M 150 100 L 350 100" stroke="url(#line-grad)" strokeWidth="2" className="flow-line" />
        <path d="M 150 210 L 350 210" stroke="url(#line-grad)" strokeWidth="2" className="flow-line" />
        <path d="M 150 320 L 350 320" stroke="url(#line-grad)" strokeWidth="2" className="flow-line" />
        <path d="M 470 100 C 570 100, 570 210, 630 210" stroke="url(#line-grad)" strokeWidth="2" fill="none" className="flow-line" />
        <path d="M 470 210 L 630 210" stroke="url(#line-grad)" strokeWidth="2" className="flow-line" />
        <path d="M 470 320 C 570 320, 570 210, 630 210" stroke="url(#line-grad)" strokeWidth="2" fill="none" className="flow-line" />
      </svg>
      {[
        { top: 76, left: 20, label: "amazon.jobs", sub: "AI Agent" },
        { top: 186, left: 20, label: "careers.google.com", sub: "AI Agent" },
        { top: 296, left: 20, label: "meta.com/careers", sub: "AI Agent" },
      ].map((n, i) => (
        <motion.div key={n.label} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }}
          className="absolute w-36 px-3 py-2 rounded-lg bg-card border border-border font-mono text-xs" style={{ top: n.top, left: n.left }}>
          <div className="font-semibold truncate">{n.label}</div>
          <div className="text-[10px] text-lime">{n.sub}</div>
        </motion.div>
      ))}
      {[
        { top: 76, left: 350, label: "Scrape" },
        { top: 186, left: 350, label: "Normalize" },
        { top: 296, left: 350, label: "Dedup" },
      ].map((n, i) => (
        <motion.div key={n.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.1 }}
          className="absolute w-28 px-3 py-2 rounded-lg bg-primary/10 border border-primary/40 text-center node-pulse" style={{ top: n.top, left: n.left }}>
          <div className="text-xs font-semibold text-primary">{n.label}</div>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 }}
        className="absolute top-[186px] left-[630px] w-36 px-4 py-3 rounded-xl bg-foreground text-background border-2 border-lime text-center node-pulse">
        <Zap className="w-4 h-4 mx-auto mb-1" />
        <div className="text-xs font-semibold">BlinkedIn</div>
        <div className="text-[10px] opacity-70">Live Feed / API</div>
      </motion.div>
    </div>
  );
}

function ThreeServices() {
  const services = [
    { icon: Zap, title: "Live Job Feed", body: "Real-time roles from 1000+ careers pages, refreshed every few minutes.", color: "primary" },
    { icon: Shield, title: "Insider Referrals", body: "Verified employees push your résumé into their company ATS. Earn rewards for both sides.", color: "primary" },
    { icon: Cpu, title: "AI Agents API", body: "Rent our scraping agents — same live feed, embedded on your product via a monthly subscription.", color: "lime" },
  ];
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {services.map((s, i) => (
        <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
          className="p-6 rounded-2xl bg-card border border-border card-hover">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${s.color === "lime" ? "bg-lime/20" : "bg-primary/10"}`}>
            <s.icon className={`w-5 h-5 ${s.color === "lime" ? "text-lime" : "text-primary"}`} />
          </div>
          <h3 className="font-display text-lg font-semibold tracking-tight">{s.title}</h3>
          <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

function AIOrbits() {
  const orbitBig = ["google.com", "amazon.com", "microsoft.com", "meta.com"];
  const orbitSmall = ["nvidia.com", "stripe.com"];
  return (
    <div className="relative flex items-center justify-center h-[380px]" data-testid="ai-orbits">
      <div className="absolute w-[340px] h-[340px] rounded-full border border-primary/20 orbit-slow">
        {orbitBig.map((d, i) => {
          const pos = [
            "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
            "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2",
            "right-0 top-1/2 -translate-y-1/2 translate-x-1/2",
          ][i];
          return (
            <div key={d} className={`absolute ${pos} w-12 h-12 rounded-full bg-card border border-primary/40 flex items-center justify-center p-2`}>
              <CompanyLogo company={d.split(".")[0]} src={`https://logo.clearbit.com/${d}`} size={28} rounded="rounded-full" />
            </div>
          );
        })}
      </div>
      <div className="absolute w-[220px] h-[220px] rounded-full border border-lime/30 orbit-fast">
        {orbitSmall.map((d, i) => {
          const pos = i === 0 ? "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" : "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2";
          return (
            <div key={d} className={`absolute ${pos} w-10 h-10 rounded-full bg-lime/20 border border-lime/60 flex items-center justify-center p-1.5`}>
              <CompanyLogo company={d.split(".")[0]} src={`https://logo.clearbit.com/${d}`} size={24} rounded="rounded-full" />
            </div>
          );
        })}
      </div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-32 h-32 rounded-full bg-primary flex items-center justify-center border-4 border-lime/40 shadow-2xl">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-white mx-auto" />
          <div className="text-xs font-mono text-white/80 mt-1">AI Agent</div>
        </div>
        <div className="absolute inset-0 rounded-full data-pulse border-2 border-primary" />
      </motion.div>
    </div>
  );
}

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api.get("/jobs/recent?limit=10").then((r) => setJobs(r.data)).catch(() => {});
    api.get("/companies").then((r) => setCompanies(r.data)).catch(() => {});
    const t = setInterval(() => api.get("/jobs/recent?limit=10").then((r) => setJobs(r.data)).catch(() => {}), 30000);
    setActiveCount(1284 + Math.floor(Math.random() * 200));
    return () => clearInterval(t);
  }, []);

  const handleJobClick = (id) => {
    if (!user) nav("/login?next=/jobs/" + id);
    else nav("/jobs/" + id);
  };

  const marqueeCompanies = companies.length > 0 ? [...companies, ...companies] : [];

  return (
    <div className="pt-24 pb-16" data-testid="home-page">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="glow-blob w-[500px] h-[500px] bg-primary/40 -top-40 -left-40" />
        <div className="glow-blob w-[400px] h-[400px] bg-lime/20 top-20 right-0" />
        <div className="grid-bg absolute inset-0 -z-10" />
        <div className="max-w-7xl mx-auto px-6 py-20 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs mb-6">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            <span className="font-mono text-primary font-medium">{activeCount.toLocaleString()} people hiring right now</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter max-w-4xl leading-[1.02]">
            The job feed that <span className="text-primary">never sleeps</span>
            <span className="text-lime">.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl">
            AI agents scrape 1000+ career sites — Amazon, Google, Meta and beyond — and drop new roles into your feed within seconds. Land interviews with insider referrals.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex gap-3 mt-8 flex-wrap">
            <Button size="lg" className="btn-lift" onClick={() => nav("/jobs")} data-testid="hero-browse-btn">
              Browse jobs <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => nav("/ai-agent")} data-testid="hero-ai-btn">
              <Cpu className="w-4 h-4 mr-2" /> AI Agent API
            </Button>
          </motion.div>
          <div className="grid sm:grid-cols-3 gap-6 mt-14 max-w-3xl">
            {[
              { icon: Globe, label: "1000+", sub: "Career sites scraped" },
              { icon: Zap, label: "<3s", sub: "Posted → your feed" },
              { icon: Shield, label: "Verified", sub: "Insider referrals" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-display font-bold text-xl">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 services */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-lime font-bold">3 services · One platform</div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 tracking-tight">Jobs · Referrals · AI Agents</h2>
        </div>
        <ThreeServices />
      </section>

      {/* Flowchart */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-primary font-bold">How the pipeline works</div>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-2 tracking-tight">Scrape → Normalize → Deliver</h2>
        </div>
        <AnimatedFlowchart />
      </section>

      {/* AI Agent hero */}
      <section className="max-w-7xl mx-auto px-6 py-16" data-testid="ai-agent-section">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime/20 border border-lime/40 text-xs mb-4">
              <Cpu className="w-3 h-3 text-lime" />
              <span className="font-mono font-medium">New · Rent our AI Agents</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tighter">
              Your product <br /> deserves live jobs data.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Give us a career URL — our AI agents crawl, extract and normalize new postings. Access it via a simple REST API you can embed anywhere.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2"><Network className="w-4 h-4 text-primary" /><span>1000+ career sites, auto-normalized schema</span></li>
              <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /><span>Sub-3-second freshness on new job drops</span></li>
              <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /><span>API key rotates monthly / yearly with your subscription</span></li>
            </ul>
            <div className="flex gap-3 mt-6">
              <Button size="lg" className="btn-lift" onClick={() => nav("/ai-agent")} data-testid="ai-section-cta">Get API access</Button>
              <Button size="lg" variant="outline" onClick={() => nav("/technology")}>How it works</Button>
            </div>
          </div>
          <AIOrbits />
        </div>
      </section>

      {/* Logo marquee — WITH LOGOS + NAMES */}
      <section className="relative overflow-hidden py-8 border-y border-border" data-testid="logo-carousel">
        <div className="flex marquee-track gap-10 whitespace-nowrap w-max">
          {marqueeCompanies.map((c, i) => (
            <div key={`${c.name}-${i}`} className="flex items-center gap-3 shrink-0 opacity-80 hover:opacity-100 transition-opacity">
              <CompanyLogo company={c.name} src={c.logo} size={32} />
              <span className="font-display font-semibold text-sm">{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Fresh jobs + Leaderboard side by side */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2" data-testid="recent-jobs-section">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-primary font-bold">Fresh drops</div>
                <h2 className="font-display text-3xl font-semibold mt-2 tracking-tight">Just landed</h2>
              </div>
              <Button variant="outline" onClick={() => user ? nav("/jobs") : nav("/login?next=/jobs")} data-testid="explore-more-btn">
                Explore more <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <div className="grid gap-3">
              {jobs.map((j, i) => (
                <motion.button
                  key={j.id} onClick={() => handleJobClick(j.id)}
                  initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.03 }}
                  className="card-hover flex items-center gap-4 p-4 rounded-xl bg-card border border-border text-left w-full"
                  data-testid={`home-job-card-${i}`}
                >
                  <CompanyLogo company={j.company} src={j.logo} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{j.role}</div>
                    <div className="text-sm text-muted-foreground flex gap-3 flex-wrap">
                      <span className="font-medium text-foreground">{j.company}</span>
                      <span>·</span><span>{j.experience}</span>
                      <span>·</span><span>{j.location}</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-xs font-mono text-primary">{j.type}</div>
                  <ArrowRight className="w-4 h-4 opacity-40" />
                </motion.button>
              ))}
            </div>
          </div>
          <div>
            <Leaderboard compact testid="home-leaderboard" />
          </div>
        </div>
      </section>
    </div>
  );
}
