import { motion } from "framer-motion";
import { Radio, Database, GitBranch, Shield, Zap, Cpu, Code, Network, Server } from "lucide-react";

const BLOCKS = [
  { icon: Radio, title: "Real-time AI scrapers", body: "Custom AI agents per career site (Amazon, Google, Meta, and 1000+) run every few minutes and stream new roles into our pipeline." },
  { icon: GitBranch, title: "Normalizer & dedup", body: "Roles are normalized to a canonical schema and deduplicated across ATS providers (Greenhouse, Lever, Workday)." },
  { icon: Database, title: "Storage & indexing", body: "Fresh jobs are stored in MongoDB with full-text search indexes. Feed capped at the most-recent — stale entries auto-evicted." },
  { icon: Zap, title: "<3s propagation", body: "From posted on the source site to visible on BlinkedIn — median under 3 seconds." },
  { icon: Shield, title: "Referral verification", body: "Employees upload govt + company IDs, hand-reviewed by admins. Only verified referrers can push refs to their company's ATS." },
  { icon: Cpu, title: "AI Agents API", body: "Same agents, exposed as a REST API. Rent them monthly (₹499) or yearly (₹2499). Cancel anytime; access expires automatically." },
];

export default function Technology() {
  return (
    <div className="pt-24 pb-16 max-w-6xl mx-auto px-6" data-testid="technology-page">
      <div className="max-w-3xl mb-14">
        <div className="text-xs uppercase tracking-widest text-primary font-bold">How it works</div>
        <h1 className="font-display text-5xl font-bold tracking-tighter mt-2">Three services · One platform.</h1>
        <p className="text-muted-foreground mt-4 text-lg">
          BlinkedIn is a distributed job-aggregation pipeline with three fronts: a real-time <strong>Job Feed</strong>,
          an <strong>Insider Referrals</strong> marketplace, and an <strong>AI Agents API</strong> other builders can rent.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {BLOCKS.map((b, i) => (
          <motion.div key={b.title}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-2xl bg-card border border-border card-hover">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <b.icon className="w-5 h-5" />
            </div>
            <h3 className="font-display text-xl font-semibold tracking-tight">{b.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{b.body}</p>
          </motion.div>
        ))}
      </div>

      {/* Embed docs */}
      <section className="mt-16" data-testid="api-embed-section">
        <div className="text-xs uppercase tracking-widest text-lime font-bold">For builders</div>
        <h2 className="font-display text-3xl font-semibold tracking-tight mt-2">Embed BlinkedIn AI Agents in your product</h2>
        <p className="text-muted-foreground mt-3 max-w-3xl">
          Building a career-tech product? Use our AI Agents API to power your live jobs feed. One key, thousands of sources, normalized JSON.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="p-5 rounded-xl bg-card border border-border">
            <Network className="w-5 h-5 text-primary mb-3" />
            <h4 className="font-semibold">1. Subscribe</h4>
            <p className="text-sm text-muted-foreground mt-1">Pick monthly ₹499 or yearly ₹2499. Access is issued instantly.</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <Code className="w-5 h-5 text-primary mb-3" />
            <h4 className="font-semibold">2. Get your key</h4>
            <p className="text-sm text-muted-foreground mt-1">Shown on your Profile + AI Agent page immediately after payment.</p>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <Server className="w-5 h-5 text-primary mb-3" />
            <h4 className="font-semibold">3. Call the API</h4>
            <div className="mt-2 p-3 rounded-md bg-muted font-mono text-[11px] overflow-x-auto">
              <pre>curl -H "Authorization: Bearer bli_..." \{"\n"}  https://api.blinkedin.co/v1/jobs</pre>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-card border border-border">
            <Cpu className="w-5 h-5 text-primary mb-3" />
            <h4 className="font-semibold">4. Auto-expire</h4>
            <p className="text-sm text-muted-foreground mt-1">Key stops working the day your subscription ends. No surprise charges.</p>
          </div>
        </div>
      </section>

      <div className="mt-16 p-8 rounded-2xl bg-primary/5 border border-primary/30 text-center">
        <div className="font-mono text-xs text-primary uppercase tracking-widest">Stack</div>
        <div className="font-display text-2xl font-semibold mt-2">FastAPI · MongoDB · React · Claude Sonnet 4.5 · Stripe · Resend</div>
      </div>
    </div>
  );
}
