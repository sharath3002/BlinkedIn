import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoMark } from "@/lib/brand";
import { toast } from "sonner";

export default function ResetPassword() {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    try {
      await resetPassword(token, pw);
      setDone(true);
      toast.success("Password updated");
      setTimeout(() => nav("/login"), 2500);
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" data-testid="reset-password-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2.5 mb-6">
          <LogoMark size={32} />
          <div className="font-display font-bold text-lg tracking-tighter">BlinkedIn</div>
        </div>

        {done ? (
          <div className="text-center py-4" data-testid="reset-done">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
            <div className="font-display text-2xl font-bold tracking-tighter mb-1">Password updated</div>
            <p className="text-sm text-muted-foreground mb-6">Redirecting to sign in…</p>
            <Link to="/login"><Button className="w-full">Sign in now</Button></Link>
          </div>
        ) : (
          <>
            <div className="text-xs uppercase tracking-widest text-primary font-bold mb-2">Set a new password</div>
            <h1 className="font-display text-3xl font-bold tracking-tighter mb-6">Choose a strong one</h1>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} data-testid="reset-pw-input" />
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm-input" />
              </div>
              <Button type="submit" className="w-full btn-lift" disabled={loading} data-testid="reset-submit">
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
