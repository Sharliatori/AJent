import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { FileText, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Clock, ChevronDown, ChevronRight } from "lucide-react";

export default function PortalReports() {
  const { clientUser } = useAuth();
  const clientId = clientUser?.client_id;
  const [monitoring, setMonitoring] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [perfResults, setPerfResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!clientId) return;
    loadReports();
  }, [clientId]);

  async function loadReports() {
    try {
      const [monRes, snapRes, perfRes] = await Promise.all([
        supabase.from("monitoring_results").select("*").eq("client_id", clientId).order("checked_at", { ascending: false }).limit(20),
        supabase.from("daily_snapshots").select("*").eq("client_id", clientId).order("checked_at", { ascending: false }).limit(30),
        supabase.from("performance_results").select("*").eq("client_id", clientId).order("checked_at", { ascending: false }).limit(10),
      ]);
      setMonitoring(monRes.data || []);
      setSnapshots(snapRes.data || []);
      setPerfResults(perfRes.data || []);
    } catch (err) {
      console.error("Error loading reports:", err);
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
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports & Analyses</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Historique des controles effectues sur votre site
        </p>
      </div>

      {perfResults.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            Derniers scores de performance
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {perfResults.slice(0, 2).map((perf) => (
              <div key={perf.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-2">
                  {new Date(perf.checked_at).toLocaleDateString("fr-FR")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mobile</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {perf.mobile_score ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Desktop</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {perf.desktop_score ?? "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">Controles quotidiens</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {snapshots.length === 0 && (
            <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Aucun controle disponible.</p>
          )}
          {snapshots.map((snap) => {
            const hasIssues = snap.issues && snap.issues.length > 0;
            const isExpanded = expanded === snap.id;
            return (
              <div key={snap.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : snap.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition text-left"
                >
                  {hasIssues ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                    {snap.snapshot_date} ({snap.slot === "morning" ? "Matin" : "Soir"})
                  </span>
                  <span className="text-xs text-slate-400">
                    {snap.http_ok ? "HTTP OK" : "HTTP KO"} | {snap.ssl_ok ? "SSL OK" : "SSL KO"}
                  </span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4 pl-12">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                      <div>
                        <span className="text-slate-400">HTTP</span>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{snap.http_status_code || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">SSL</span>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{snap.ssl_days_left != null ? `${snap.ssl_days_left}j` : "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Temps reponse</span>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{snap.response_time_ms ? `${snap.response_time_ms}ms` : "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Heure</span>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{new Date(snap.checked_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    {hasIssues && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-400 mb-1">Problemes detectes :</p>
                        <ul className="space-y-1">
                          {snap.issues.map((issue, i) => (
                            <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-amber-500" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
