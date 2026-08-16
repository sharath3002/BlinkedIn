import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/lib/brand";
import { toast } from "sonner";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [directLink, setDirectLink] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setSent(true);
      if (res?.fallback_link) {
        // Email delivery unavailable — hand the link to the user directly.
        setDirectLink(res.fallback_link);
        toast.success("Email delivery is offline — use the link below to reset.", { duration: 6000 });
      } else {
        toast.success("Check your inbox");
      }
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" data-testid="forgot-password-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2.5 mb-6">
          <LogoMark size={32} />
          <div className="font-display font-bold text-lg tracking-tighter">BlinkedIn</div>
        </div>

        {sent ? (
          <div className="text-center py-4" data-testid="forgot-sent">
            <Mail className="w-14 h-14 text-primary mx-auto mb-4" />
            <div className="font-display text-2xl font-bold tracking-tighter mb-1">
              {directLink ? "Reset link ready" : "Check your inbox"}
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {directLink
                ? <>Our email service is in dev-sandbox mode, so we can't deliver to <strong>{email}</strong>. Use the link below to reset your password now.</>
                : <>If an account exists for <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.</>}
            </p>
            {directLink && (
              <div className="mb-4 p-3 rounded-lg bg-muted text-left" data-testid="forgot-direct-link-block">
                <p className="text-xs uppercase tracking-widest text-primary font-bold mb-1">Direct link</p>
                <a href={directLink} className="text-xs font-mono break-all text-primary hover:underline" data-testid="forgot-direct-link">
                  {directLink}
                </a>
              </div>
            )}
            <Link to="/login"><Button variant="outline" className="w-full"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back to sign in</Button></Link>
          </div>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Password recovery</div>
            <h1 className="font-display text-3xl font-bold tracking-tighter mb-2">Forgot your password?</h1>
            <p className="text-sm text-muted-foreground mb-6">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email-input" />
              </div>
              <Button type="submit" className="w-full btn-lift" disabled={loading} data-testid="forgot-submit">
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              Remembered it? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
