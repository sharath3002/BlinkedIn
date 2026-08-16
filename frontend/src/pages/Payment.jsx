import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sid = params.get("session_id");
  const [status, setStatus] = useState("polling");
  const [tries, setTries] = useState(0);
  const { refresh } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!sid) { setStatus("error"); return; }
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sid}`);
        if (data.payment_status === "paid") { setStatus("paid"); await refresh(); return; }
        if (data.payment_status === "failed" || data.payment_status === "expired") { setStatus("failed"); return; }
        if (tries > 20) { setStatus("timeout"); return; }
        setTimeout(() => setTries((t) => t + 1), 2000);
      } catch { setStatus("error"); }
    };
    poll();
  }, [tries, sid]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-success-page">
      <div className="max-w-md text-center">
        {status === "polling" && (
          <>
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto mb-6" />
            <h1 className="font-display text-2xl font-bold">Confirming payment...</h1>
            <p className="text-muted-foreground mt-2">This usually takes a couple of seconds.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
            <h1 className="font-display text-3xl font-bold tracking-tighter">Payment successful!</h1>
            <p className="text-muted-foreground mt-2">Your subscription is now active. Enjoy unlimited access.</p>
            <div className="flex gap-2 justify-center mt-6">
              <Button onClick={() => nav("/jobs")} data-testid="ps-jobs-btn">Browse jobs</Button>
              <Button variant="outline" onClick={() => nav("/profile")} data-testid="ps-profile-btn">View profile</Button>
            </div>
          </>
        )}
        {(status === "failed" || status === "error" || status === "timeout") && (
          <>
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-6" />
            <h1 className="font-display text-2xl font-bold">Payment {status === "timeout" ? "still processing" : "failed"}</h1>
            <p className="text-muted-foreground mt-2">
              {status === "timeout" ? "It's taking longer than usual. We'll activate your subscription as soon as payment confirms." : "Something went wrong. Please try again."}
            </p>
            <Button className="mt-6" onClick={() => nav("/pricing")}>Back to pricing</Button>
          </>
        )}
      </div>
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="payment-cancel-page">
      <div className="max-w-md text-center">
        <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="font-display text-2xl font-bold">Payment cancelled</h1>
        <p className="text-muted-foreground mt-2">No charge was made. You can try again anytime.</p>
        <Link to="/pricing"><Button className="mt-6">Back to pricing</Button></Link>
      </div>
    </div>
  );
}
