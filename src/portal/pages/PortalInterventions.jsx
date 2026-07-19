import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { Wrench, Calendar, CircleCheck as CheckCircle, Clock, ArrowRight } from "lucide-react";

const statusConfig = {
  planned: { label: "Planifiee", color: "bg-blue-500", textClass: "text-blue-600 dark:text-blue-400", bgClass: "bg-blue-50 dark:bg-blue-900/20" },
  "in-progress": { label: "En cours", color: "bg-amber-500", textClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-900/20" },
  completed: { label: "Terminee", color: "bg-emerald-500", textClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-900/20" },
};

export default function PortalInterventions() {
  const { clientUser } = useAuth();
  const clientId = clientUser?.client_id;
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    loadInterventions();
  }, [clientId]);

  async function loadInterventions() {
    try {
      const { data, error } = await supabase
        .from("interventions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInterventions(data || []);
    } catch (err) {
      console.error("Error loading interventions:", err);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Suivi des interventions</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Historique et suivi des interventions sur votre site
        </p>
      </div>

      {interventions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Wrench className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Aucune intervention enregistree.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-6">
            {interventions.map(inter => {
              const cfg = statusConfig[inter.status];
              return (
                <div key={inter.id} className="relative pl-14">
                  <div className={`absolute left-4 top-5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${cfg.color}`} />
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-medium text-slate-900 dark:text-white">{inter.title}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.bgClass} ${cfg.textClass}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {inter.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{inter.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {inter.started_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Debut: {new Date(inter.started_at).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {inter.completed_at && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Fin: {new Date(inter.completed_at).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {!inter.started_at && !inter.completed_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Creee le {new Date(inter.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
