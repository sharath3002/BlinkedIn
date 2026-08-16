import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, MessageSquare } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const SUPPORT_EMAIL = "blinkedinsupport@gmail.com";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/contact", form);
      toast.success(data.message);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) { toast.error(formatErr(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="pt-24 pb-16 max-w-4xl mx-auto px-6" data-testid="contact-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-xs uppercase tracking-widest text-primary font-bold">Contact us</div>
        <h1 className="font-display text-4xl font-bold tracking-tighter mt-2">Have a question?</h1>
        <p className="text-muted-foreground mt-2 mb-8">We reply within 5 working days. Every submission gets an auto-confirmation email.</p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <form onSubmit={submit} className="space-y-4 p-6 rounded-xl bg-card border border-border">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="contact-name-input" /></div>
                <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="contact-email-input" /></div>
              </div>
              <div><Label>Subject</Label><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="contact-subject-input" /></div>
              <div><Label>Message</Label><Textarea rows={5} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="contact-message-input" /></div>
              <Button type="submit" disabled={loading} className="w-full btn-lift" data-testid="contact-submit-btn">{loading ? "Sending..." : "Send message"}</Button>
            </form>
          </div>

          <div className="space-y-4" data-testid="contact-details">
            <div className="p-5 rounded-xl bg-primary/5 border border-primary/30">
              <Mail className="w-5 h-5 text-primary mb-3" />
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Email us</div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary font-semibold text-sm break-all hover:underline" data-testid="contact-support-email">
                {SUPPORT_EMAIL}
              </a>
              <p className="text-xs text-muted-foreground mt-2">
                For sales, partnerships, API integrations, or any other question.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <MessageSquare className="w-5 h-5 text-lime mb-3" />
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Response time</div>
              <div className="text-sm font-semibold">Within 5 working days</div>
              <p className="text-xs text-muted-foreground mt-2">
                You'll receive an auto-confirmation email immediately after submitting.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
