import { useEffect, useState } from "react";
import { X, Play, Save, RotateCcw, Loader2, Check, AlertCircle } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * AgentTrainer — modal for editing an AI agent's system prompt, testing it live,
 * and saving instructions. Live-connects to Claude Sonnet 4.5 through /api/admin/agents/{id}/test.
 */
export default function AgentTrainer({ agentId, onClose, onSaved }) {
  const [agent, setAgent] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    api.get(`/admin/agents/${agentId}`).then((r) => {
      setAgent(r.data);
      setPrompt(r.data.system_prompt || "");
      setNotes(r.data.training_notes || "");
    });
  }, [agentId]);

  const resetToDefault = async () => {
    const { data } = await api.get(`/admin/agents/prompt/default`);
    setPrompt(data.system_prompt);
    toast.info("Reset to default prompt");
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so test uses current prompt
      await api.post(`/admin/agents/${agentId}/instructions`, {
        system_prompt: prompt, training_notes: notes,
      });
      const { data } = await api.post(`/admin/agents/${agentId}/test`);
      setTestResult(data);
      if (data.ok) toast.success(`Extracted ${data.count} jobs`);
      else toast.error(data.error || "Test failed");
    } catch (e) { toast.error(formatErr(e)); }
    finally { setTesting(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/admin/agents/${agentId}/instructions`, {
        system_prompt: prompt, training_notes: notes,
      });
      toast.success("Instructions deployed. Agent will use these on next run.");
      onSaved?.();
      onClose?.();
    } catch (e) { toast.error(formatErr(e)); }
    finally { setSaving(false); }
  };

  if (!agent) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center">
        <div className="p-6 bg-card rounded-xl border border-border">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" data-testid="agent-trainer-modal">
      <div className="bg-card rounded-2xl border border-border w-full max-w-4xl my-8 max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-bold">Train agent</div>
            <div className="font-display font-bold text-xl">{agent.company}</div>
            <div className="text-xs text-muted-foreground font-mono truncate max-w-md">{agent.url}</div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="trainer-close-btn">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                Agent instructions (system prompt)
              </label>
              <Button variant="outline" size="sm" onClick={resetToDefault} data-testid="reset-prompt-btn">
                <RotateCcw className="w-3 h-3 mr-1" />Reset to default
              </Button>
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              placeholder="Tell the agent how to extract jobs from this specific career site..."
              className="font-mono text-xs"
              data-testid="agent-prompt-textarea"
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Powered by Claude Sonnet 4.5. Instructions are used every time the agent runs (every 5 min).
              Focus on: recency, filters, fields to extract, edge cases.
            </p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2 block">
              Training notes (optional, for your team)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 'Ignore jobs from Life-at-Google section'"
              data-testid="agent-notes-input"
            />
          </div>

          {/* Test result */}
          <div className="p-4 rounded-xl bg-muted border border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Live test</div>
              <Button size="sm" onClick={runTest} disabled={testing} data-testid="test-agent-btn">
                {testing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running...</> : <><Play className="w-3.5 h-3.5 mr-1.5" />Test now</>}
              </Button>
            </div>
            {testResult ? (
              <div>
                {testResult.ok ? (
                  <div className="flex items-center gap-2 text-sm text-lime mb-3">
                    <Check className="w-4 h-4" />
                    Extracted <strong>{testResult.count}</strong> jobs from {testResult.html_size} bytes of HTML
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-destructive mb-3">
                    <AlertCircle className="w-4 h-4" />
                    {testResult.error}
                  </div>
                )}
                {testResult.jobs?.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {testResult.jobs.slice(0, 5).map((j, i) => (
                      <div key={i} className="p-3 rounded-lg bg-card border border-border" data-testid={`test-job-${i}`}>
                        <div className="font-semibold text-sm">{j.role}</div>
                        <div className="text-xs text-muted-foreground">{j.location} · {j.experience}</div>
                        <div className="text-xs mt-1 line-clamp-2">{j.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Test the agent to see what it extracts right now, before deploying.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="btn-lift" data-testid="save-agent-btn">
            {saving ? "Deploying..." : <><Save className="w-4 h-4 mr-1.5" />Deploy instructions</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
