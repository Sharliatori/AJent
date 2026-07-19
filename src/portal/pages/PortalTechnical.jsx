import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { Cpu, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Circle as XCircle } from "lucide-react";

const categoryLabels = {
  framework: "Framework",
  cms: "CMS",
  plugin: "Plugin",
  library: "Librairie",
  hosting: "Hebergement",
  language: "Langage",
  database: "Base de donnees",
};

const statusConfig = {
  "up-to-date": { label: "A jour", icon: CheckCircle, class: "text-emerald-600 dark:text-emerald-400" },
  outdated: { label: "Obsolete", icon: AlertTriangle, class: "text-amber-600 dark:text-amber-400" },
  deprecated: { label: "Deprecie", icon: XCircle, class: "text-red-600 dark:text-red-400" },
};

export default function PortalTechnical() {
  const { clientUser } = useAuth();
  const clientId = clientUser?.client_id;
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    loadComponents();
  }, [clientId]);

  async function loadComponents() {
    try {
      const { data, error } = await supabase
        .from("site_components")
        .select("*")
        .eq("client_id", clientId)
        .order("category", { ascending: true });
      if (error) throw error;
      setComponents(data || []);
    } catch (err) {
      console.error("Error loading components:", err);
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

  const grouped = components.reduce((acc, comp) => {
    if (!acc[comp.category]) acc[comp.category] = [];
    acc[comp.category].push(comp);
    return acc;
  }, {});

  const upToDate = components.filter(c => c.status === "up-to-date").length;
  const outdated = components.filter(c => c.status === "outdated").length;
  const deprecated = components.filter(c => c.status === "deprecated").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Composants techniques</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Inventaire des technologies utilisees sur votre site
        </p>
      </div>

      {components.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Cpu className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Aucun composant technique enregistre.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">A jour</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{upToDate}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Obsoletes</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{outdated}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Deprecies</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{deprecated}</p>
            </div>
          </div>

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">
                {categoryLabels[category] || category}
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-5 py-2.5 font-medium text-slate-600 dark:text-slate-400">Composant</th>
                      <th className="text-left px-5 py-2.5 font-medium text-slate-600 dark:text-slate-400">Version</th>
                      <th className="text-left px-5 py-2.5 font-medium text-slate-600 dark:text-slate-400">Derniere</th>
                      <th className="text-left px-5 py-2.5 font-medium text-slate-600 dark:text-slate-400">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map(comp => {
                      const sCfg = statusConfig[comp.status];
                      const Icon = sCfg.icon;
                      return (
                        <tr key={comp.id}>
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900 dark:text-white">{comp.name}</p>
                            {comp.notes && <p className="text-xs text-slate-400 mt-0.5">{comp.notes}</p>}
                          </td>
                          <td className="px-5 py-3 text-slate-700 dark:text-slate-300 font-mono text-xs">{comp.version || "-"}</td>
                          <td className="px-5 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{comp.latest_version || "-"}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${sCfg.class}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {sCfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
