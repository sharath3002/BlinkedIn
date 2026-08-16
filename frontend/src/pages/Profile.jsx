import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Upload, Briefcase, Cpu, Copy, Lock } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import CompanyLogo from "@/components/CompanyLogo";

export default function Profile() {
  const { user, loading, changePassword } = useAuth();
  const nav = useNavigate();
  const [refs, setRefs] = useState([]);
  const [apps, setApps] = useState([]);
  const [uploadState, setUploadState] = useState({});
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav("/login"); return; }
    api.get("/referrals/mine").then((r) => setRefs(r.data));
    api.get("/jobs/mine/applications").then((r) => setApps(r.data));
  }, [user, loading, nav]);

  const uploadProof = async (refId, type) => {
    const url = uploadState[`${refId}_${type}`];
    if (!url) return toast.error("Enter a URL first");
    try {
      await api.post(`/referrals/${refId}/proof`, { referral_id: refId, proof_type: type, proof_url: url });
      toast.success("Proof uploaded — awaiting admin verification");
      setUploadState((s) => ({ ...s, [`${refId}_${type}`]: "" }));
      api.get("/referrals/mine").then((r) => setRefs(r.data));
    } catch (e) { toast.error(formatErr(e)); }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(user?.ai_subscription?.api_key || "");
    toast.success("API key copied");
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (pwForm.next.length < 8) return toast.error("New password must be at least 8 characters");
    if (pwForm.next !== pwForm.confirm) return toast.error("Passwords don't match");
    setPwLoading(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      toast.success("Password updated");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (e) { toast.error(formatErr(e)); }
    finally { setPwLoading(false); }
  };

  if (loading) return <div className="pt-24 text-center text-muted-foreground">Loading...</div>;
  if (!user) return null;

  return (
    <div className="pt-24 pb-16 max-w-5xl mx-auto px-6" data-testid="profile-page">
      <div className="flex items-center gap-4 mb-8">
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-20 h-20 rounded-full" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary text-white text-3xl font-bold flex items-center justify-center">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tighter">{user.name}</h1>
          <div className="text-muted-foreground">{user.email}</div>
        </div>
      </div>

      {/* Subscriptions */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-xl bg-card border border-border" data-testid="subscription-block">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-2">
            <Briefcase className="w-3 h-3" />Jobs subscription
          </div>
          {user.subscription ? (
            <div>
              <div className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Active — {user.subscription.plan}</div>
              <div className="text-sm text-muted-foreground mt-1">Expires {new Date(user.subscription.expires_at).toLocaleDateString()}</div>
            </div>
          ) : (
            <div>
              <div className="font-semibold">Free plan</div>
              <div className="text-sm text-muted-foreground">{user.applications_used || 0}/10 applications used</div>
              <Button size="sm" onClick={() => nav("/pricing")} className="btn-lift mt-3" data-testid="upgrade-btn">Upgrade</Button>
            </div>
          )}
        </div>
        <div className="p-5 rounded-xl bg-card border border-border" data-testid="ai-sub-block">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-2">
            <Cpu className="w-3 h-3" />AI Agent API
          </div>
          {user.ai_subscription ? (
            <div>
              <div className="font-semibold text-lime">Active</div>
              <div className="text-sm text-muted-foreground mt-1">Expires {new Date(user.ai_subscription.expires_at).toLocaleDateString()}</div>
              <div className="mt-3 p-2 rounded-md bg-muted font-mono text-[10px] flex items-center gap-2">
                <code className="flex-1 truncate">{user.ai_subscription.api_key}</code>
                <Button size="sm" variant="outline" onClick={copyKey} data-testid="profile-copy-key">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="font-semibold">Not subscribed</div>
              <div className="text-sm text-muted-foreground">Get an API key to embed BlinkedIn in your product.</div>
              <Button size="sm" onClick={() => nav("/ai-agent")} className="btn-lift mt-3" variant="outline">Learn more</Button>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications" data-testid="profile-tab-apps">Applications ({apps.length})</TabsTrigger>
          <TabsTrigger value="referrals" data-testid="profile-tab-refs">Referrals ({refs.length})</TabsTrigger>
          {user.provider === "local" && (
            <TabsTrigger value="security" data-testid="profile-tab-security">Security</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="applications" className="mt-4" id="applications">
          {apps.length === 0 ? (
            <div className="p-8 rounded-xl bg-muted border border-border text-center text-muted-foreground">
              No applications yet. <div><Button onClick={() => nav("/jobs")} className="mt-4">Browse jobs</Button></div>
            </div>
          ) : (
            <div className="space-y-2">
              {apps.map((a) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-card border border-border flex items-center gap-4" data-testid={`app-item-${a.id}`}>
                  <CompanyLogo company={a.company} src={a.logo} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{a.role}</div>
                    <div className="text-sm text-muted-foreground">{a.company}</div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono hidden sm:block">
                    {new Date(a.applied_at).toLocaleDateString()}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="referrals" className="mt-4" id="referrals">
          {refs.length === 0 ? (
            <div className="p-8 rounded-xl bg-muted border border-border text-center text-muted-foreground">
              You haven't requested any referrals yet.
            </div>
          ) : (
            <div className="space-y-3">
              {refs.map((r) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl bg-card border border-border" data-testid={`my-ref-${r.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{r.role}</div>
                      <div className="text-sm text-muted-foreground">{r.company}</div>
                    </div>
                    <div className="text-xs font-mono px-2 py-1 rounded bg-muted">{r.status}</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Upload proofs (URL)</div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {["referred", "interview", "offer"].map((t) => (
                        <div key={t} className="flex gap-1">
                          <Input placeholder={`${t} proof URL`} value={uploadState[`${r.id}_${t}`] || ""}
                            onChange={(e) => setUploadState((s) => ({ ...s, [`${r.id}_${t}`]: e.target.value }))}
                            data-testid={`proof-input-${r.id}-${t}`} />
                          <Button size="sm" variant="outline" onClick={() => uploadProof(r.id, t)} data-testid={`proof-btn-${r.id}-${t}`}>
                            <Upload className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    {r.proofs?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-3">
                        Uploaded: {r.proofs.map((p, i) => (
                          <span key={`${r.id}-${p.type}-${i}`} className="mr-2">{p.type}{p.verified ? " ✓" : " (pending)"}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {user.provider === "local" && (
          <TabsContent value="security" className="mt-4" id="security">
            <motion.form onSubmit={submitPassword} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-lg p-6 rounded-xl bg-card border border-border space-y-4" data-testid="change-password-form">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <h3 className="font-display text-lg font-bold tracking-tight">Change password</h3>
              </div>
              <div>
                <Label htmlFor="cp-current">Current password</Label>
                <Input id="cp-current" type="password" required value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  data-testid="cp-current-input" />
              </div>
              <div>
                <Label htmlFor="cp-next">New password</Label>
                <Input id="cp-next" type="password" required minLength={8} value={pwForm.next}
                  onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                  data-testid="cp-next-input" />
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
              </div>
              <div>
                <Label htmlFor="cp-confirm">Confirm new password</Label>
                <Input id="cp-confirm" type="password" required minLength={8} value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  data-testid="cp-confirm-input" />
              </div>
              <Button type="submit" disabled={pwLoading} className="btn-lift" data-testid="cp-submit-btn">
                {pwLoading ? "Updating…" : "Update password"}
              </Button>
            </motion.form>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
