import { Link } from "react-router-dom";
import { LogoMark } from "@/lib/brand";
import { Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-24" data-testid="main-footer">
      <div className="max-w-7xl mx-auto px-6 py-14 grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <LogoMark size={32} />
            <span className="font-display font-bold text-lg tracking-tighter">
              Blinked<span className="text-lime">In</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time job feed across 1000+ companies. Insider referrals. AI agents you can rent by the month.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">Product</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/jobs" className="hover:text-primary">Jobs</Link></li>
            <li><Link to="/refer-a-talent" className="hover:text-primary">Refer a Talent</Link></li>
            <li><Link to="/ai-agent" className="hover:text-primary">AI Agent API</Link></li>
            <li><Link to="/pricing" className="hover:text-primary">Pricing</Link></li>
            <li><Link to="/technology" className="hover:text-primary">Technology</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">Company</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
            <li><Link to="/technology" className="hover:text-primary">About</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">Connect</div>
          <div className="flex gap-3">
            <a href="https://www.linkedin.com/company/b-l-i-n-k-e-d-i-n-c-o/" target="_blank" rel="noopener noreferrer" aria-label="BlinkedIn on LinkedIn" data-testid="footer-linkedin" className="w-9 h-9 rounded-lg border border-border hover:border-primary flex items-center justify-center transition-colors"><Linkedin className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>© 2026 BlinkedIn · Made with care.</div>
          <div className="font-mono">v2.0 · Public Beta</div>
        </div>
      </div>
    </footer>
  );
}
