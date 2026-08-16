import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatErr } from "@/lib/api";
import { LogoMark } from "@/lib/brand";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login, register, googleLogin } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const googleBtnRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "register" && form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
        toast.success("Welcome back!");
        nav(next);
      } else {
        const res = await register(form.name, form.email, form.password);
        if (res?.auto_verified) {
          toast.success("Account created and verified. Welcome!", { duration: 5000 });
        } else if (res?.verification_sent) {
          toast.success("Account created. Check your inbox to verify your email.", { duration: 6000 });
        } else {
          toast.success("Account created. Welcome aboard!");
        }
        nav(next);
      }
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setLoading(false);
    }
  };

  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return; // no client id configured — the fallback message below explains this
    const scriptId = "google-identity-services";
    const init = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            await googleLogin(response.credential);
            toast.success("Signed in with Google");
            nav(next);
          } catch (e) {
            toast.error(formatErr(e) || "Google auth failed");
          }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline", size: "large", shape: "rectangular",
        text: "continue_with", width: googleBtnRef.current.offsetWidth || 360,
      });
    };
    if (document.getElementById(scriptId)) { init(); return; }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [GOOGLE_CLIENT_ID]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden">
        <div className="glow-blob w-[500px] h-[500px] bg-white/20 -bottom-40 -left-40" />
        <div className="glow-blob w-[400px] h-[400px] bg-white/10 top-10 right-0" />
        <div className="relative z-10 p-16 flex flex-col justify-between text-white">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark size={36} className="!rounded-lg" />
            <span className="font-display font-bold text-2xl tracking-tighter">Blinked<span style={{color: '#C6F76A'}}>In</span></span>
          </Link>
          <div>
            <h2 className="font-display text-5xl font-bold tracking-tighter leading-tight">
              Your next role <br /> is already posted.
            </h2>
            <p className="mt-4 opacity-80 max-w-md">
              Join 12,000+ engineers, designers and PMs jumping the queue with insider referrals.
            </p>
          </div>
          <div className="opacity-70 text-sm font-mono">© BlinkedIn · 2026</div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-xs uppercase tracking-widest text-primary font-bold mb-2">{mode === "login" ? "Welcome back" : "Get started"}</div>
          <h1 className="font-display text-4xl font-bold tracking-tighter mb-2">{mode === "login" ? "Sign in" : "Create your account"}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "login" ? "Access your dashboard, jobs and referrals." : "Free forever · 10 applications on us."}
          </p>

          {GOOGLE_CLIENT_ID ? (
            <div ref={googleBtnRef} className="w-full mb-4 flex justify-center" data-testid="google-signin-btn" />
          ) : (
            <div className="w-full mb-4 text-xs text-center text-muted-foreground border border-dashed border-border rounded-md py-2.5">
              Google sign-in isn't configured yet — set REACT_APP_GOOGLE_CLIENT_ID
            </div>
          )}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="signup-name-input" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="auth-email-input" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline" data-testid="forgot-password-link">
                    Forgot?
                  </Link>
                )}
              </div>
              <Input id="password" type="password" required minLength={mode === "register" ? 8 : 6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="auth-password-input" />
              {mode === "register" && <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>}
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-lift" data-testid="auth-submit-btn">
              {loading ? "Loading..." : (mode === "login" ? "Sign in" : "Create account")}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {mode === "login" ? "Don't have an account? " : "Already have one? "}
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-primary font-medium hover:underline" data-testid="auth-toggle-mode">
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
