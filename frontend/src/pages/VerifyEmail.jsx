import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/lib/brand";
import { toast } from "sonner";

export default function VerifyEmail() {
  const { token } = useParams();
  const { verifyEmail } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await verifyEmail(token);
        if (cancelled) return;
        setStatus("success");
        setMessage(data.email ? `Email ${data.email} is now verified.` : "Your email is verified.");
        toast.success("Email verified!");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setMessage(formatErr(e));
      }
    })();
    return () => { cancelled = true; };
  }, [token, verifyEmail]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" data-testid="verify-email-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2.5 mb-6">
          <LogoMark size={32} />
          <div className="font-display font-bold text-lg tracking-tighter">BlinkedIn</div>
        </div>

        {status === "verifying" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
            <div className="font-display text-xl font-bold tracking-tight">Verifying your email…</div>
            <p className="text-sm text-muted-foreground mt-2">Hang tight for a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-4" data-testid="verify-success">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-4" />
            <div className="font-display text-2xl font-bold tracking-tighter mb-1">You're verified</div>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => nav("/jobs")} data-testid="verify-goto-jobs">Browse jobs</Button>
              <Button variant="outline" onClick={() => nav("/profile")}>Go to profile</Button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-4" data-testid="verify-error">
            <XCircle className="w-14 h-14 text-destructive mx-auto mb-4" />
            <div className="font-display text-2xl font-bold tracking-tighter mb-1">Link problem</div>
            <p className="text-sm text-muted-foreground mb-6">{message}</p>
            <div className="flex flex-col gap-2">
              <Link to="/login"><Button variant="outline" className="w-full"><Mail className="w-4 h-4 mr-1.5" /> Back to login</Button></Link>
              <p className="text-xs text-muted-foreground">Need a fresh link? Sign in, then use "Resend verification" from your profile.</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
