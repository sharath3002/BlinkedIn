import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { api } from "@/lib/api";
import CompanyLogo from "@/components/CompanyLogo";

export default function Leaderboard({ compact = false, testid = "leaderboard" }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get(`/leaderboard/referrers?limit=${compact ? 5 : 10}`)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]));
  }, [compact]);

  if (rows.length === 0) return null;

  return (
    <div data-testid={testid} className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-lime" />
        <div className="text-xs uppercase tracking-widest text-primary font-bold">Top referrers this month</div>
      </div>
      <div className="grid gap-2">
        {rows.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border card-hover"
            data-testid={`leader-row-${i}`}
          >
            <div className="w-8 flex items-center justify-center">
              {i === 0 && <Medal className="w-5 h-5 text-lime" />}
              {i === 1 && <Medal className="w-5 h-5 text-muted-foreground" />}
              {i === 2 && <Medal className="w-5 h-5 text-orange-400" />}
              {i > 2 && <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>}
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {(r.name || r.employee_first_name || "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{r.name || `${r.employee_first_name} ${r.employee_last_name}`}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CompanyLogo company={r.employee_company} src={r.company_logo} size={14} rounded="rounded" />
                <span className="truncate">{r.employee_company}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-bold text-primary text-base">${r.employee_total_earned}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{r.employee_referrals_count} refs · {r.employee_offer_count} offers</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
