import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { TrendingUp, ArrowUp, Minus, Check } from "lucide-react";

const priorityConfig = {
  high: { label: "Haute", class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "Moyenne", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  low: { label: "Basse", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const statusConfig = {
  pending: { label: "A traiter", icon: Minus, class: "text-slate-500" },
  "in-progress": { label: "En cours", icon: ArrowUp, class: "text-amber-500" },
  done: { label: "Termine", icon: Check, class: "text-emerald-500" },
};

export default function PortalImprovements() {
  const { clientUser } = useAuth();
  const clientId = clientUser?.client_id;
  const [axes, setAxes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    loadAxes();
  }, [clientId]);

  async function loadAxes() {
    try {
      const { data, error } = await supabase
        .from("improvement_axes")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAxes(data || []);
    } catch (err) {
      console.error("Error loading improvements:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const grouped = {
    pending: axes.filter(a => a.status === "pending"),
    "in-progress": axes.filter(a => a.status === "in-progress"),
    done: axes.filter(a => a.status === "done"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Axes d'amelioration</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Recommandations pour ameliorer les performances et la securite de votre site
        </p>
      </div>

      {axes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Aucune recommandation pour le moment.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([status, items]) => {
          if (items.length === 0) return null;
          const cfg = statusConfig[status];
          const Icon = cfg.icon;
          return (
            <div key={status}>
              <h3 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3 ${cfg.class}`}>
                <Icon className="w-4 h-4" />
                {cfg.label} ({items.length})
              </h3>
              <div className="space-y-3">
                {items.map(ax => {
                  const pCfg = priorityConfig[ax.priority];
                  return (
                    <div key={ax.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 dark:text-white">{ax.title}</h4>
                          {ax.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{ax.description}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${pCfg.class}`}>
                          {pCfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
