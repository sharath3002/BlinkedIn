import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sun, Moon, ChevronDown, LogOut, User as UserIcon, Briefcase, LayoutDashboard, Cpu, MailWarning } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/lib/brand";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const { user, logout, resendVerification } = useAuth();
  const nav = useNavigate();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [resending, setResending] = useState(false);

  const resend = async () => {
    if (!user) return;
    setResending(true);
    try {
      const res = await resendVerification(user.email);
      if (res?.delivered) {
        toast.success("Verification link sent — check your inbox");
      } else if (res?.fallback_link) {
        // Email delivery unavailable (Resend sandbox/domain unverified) — account auto-verified.
        toast.success("Email delivery is offline — your account has been auto-verified.", { duration: 6000 });
        // reload user in place
        window.location.reload();
      } else {
        toast.success("If that email exists, a link has been sent.");
      }
    } catch (e) {
      toast.error("Couldn't resend right now, try again shortly");
    } finally {
      setResending(false);
    }
  };

  const linkCls = ({ isActive }) =>
    `text-sm font-medium transition-colors hover:text-primary ${isActive ? "text-primary" : "text-foreground/80"}`;

  return (
    <header className="glass fixed top-0 left-0 right-0 z-50" data-testid="main-nav">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo">
          <LogoMark size={32} />
          <span className="font-display font-bold text-lg tracking-tighter hidden sm:block">
            Blinked<span className="text-lime">In</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-6">
          <NavLink to="/technology" className={linkCls} data-testid="nav-technology">Technology</NavLink>
          <NavLink to="/jobs" className={linkCls} data-testid="nav-jobs">Jobs</NavLink>
          <NavLink to="/refer-a-talent" className={linkCls} data-testid="nav-refer">Refer a Talent</NavLink>
          <NavLink to="/ai-agent" className={linkCls} data-testid="nav-ai-agent">
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" />AI Agent
            </span>
          </NavLink>
          <div className="relative" onMouseEnter={() => setPricingOpen(true)} onMouseLeave={() => setPricingOpen(false)}>
            <button className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors flex items-center gap-1" data-testid="nav-pricing-btn">
              Pricing <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {pricingOpen && (
              <div className="absolute top-full pt-3 left-1/2 -translate-x-1/2 w-72" data-testid="pricing-dropdown">
                <div className="bg-card border border-border rounded-xl shadow-xl p-3 space-y-1">
                  {[
                    { p: "₹199", d: "1 Month", to: "/pricing?plan=monthly_199" },
                    { p: "₹399", d: "6 Months", to: "/pricing?plan=half_399" },
                    { p: "₹699", d: "1 Year", to: "/pricing?plan=yearly_699" },
                  ].map((x) => (
                    <button key={x.to} onClick={() => nav(x.to)} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-left">
                      <span className="text-sm font-medium">{x.d}</span>
                      <span className="text-sm font-mono text-primary">{x.p}</span>
                    </button>
                  ))}
                  <div className="border-t border-border pt-2 mt-2">
                    <button onClick={() => nav("/ai-agent")} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-left">
                      <span className="text-sm font-medium flex items-center gap-1"><Cpu className="w-3 h-3" />AI Agent API</span>
                      <span className="text-sm font-mono text-primary">₹499+</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <NavLink to="/contact" className={linkCls} data-testid="nav-contact">Contact</NavLink>
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-lg border border-border hover:border-primary transition-colors flex items-center justify-center"
            data-testid="theme-toggle-btn"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors" data-testid="profile-btn">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  {user.subscription ? (
                    <div className="text-xs text-primary mt-1">✦ Jobs · until {new Date(user.subscription.expires_at).toLocaleDateString()}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">No jobs subscription</div>
                  )}
                  {user.ai_subscription && (
                    <div className="text-xs text-lime mt-0.5">✦ AI · until {new Date(user.ai_subscription.expires_at).toLocaleDateString()}</div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => nav("/profile")} data-testid="menu-profile"><UserIcon className="w-4 h-4 mr-2" />Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav("/profile#applications")} data-testid="menu-apps"><Briefcase className="w-4 h-4 mr-2" />My Applications</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav("/profile#referrals")} data-testid="menu-referrals"><Briefcase className="w-4 h-4 mr-2" />My Referrals</DropdownMenuItem>
                {user.is_employee && (
                  <DropdownMenuItem onClick={() => nav("/employee-dashboard")} data-testid="menu-employee-dash">
                    <LayoutDashboard className="w-4 h-4 mr-2" />Employee Dashboard
                  </DropdownMenuItem>
                )}
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => nav("/admin")} data-testid="menu-admin">
                    <LayoutDashboard className="w-4 h-4 mr-2" />Admin Panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await logout(); nav("/"); }} data-testid="menu-logout">
                  <LogOut className="w-4 h-4 mr-2" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => nav("/login")} className="btn-lift" data-testid="nav-signin-btn">
              Sign in
            </Button>
          )}
        </div>
      </div>
      {user && user.provider === "local" && user.verified === false && (
        <div className="bg-lime text-black text-xs font-medium px-6 py-2 flex items-center justify-center gap-3 flex-wrap" data-testid="verify-email-banner">
          <MailWarning className="w-3.5 h-3.5" />
          <span>Verify your email to apply for jobs & request referrals.</span>
          <button onClick={resend} disabled={resending} className="underline font-semibold hover:no-underline disabled:opacity-60" data-testid="resend-verification-btn">
            {resending ? "Sending…" : "Resend link"}
          </button>
        </div>
      )}
    </header>
  );
}
