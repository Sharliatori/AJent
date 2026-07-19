import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { Activity, Shield, Globe, Zap, MessageSquare, Wrench, CreditCard, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock } from "lucide-react";

export default function PortalDashboard() {
  const { clientUser } = useAuth();
  const clientId = clientUser?.client_id;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    loadDashboardData();
  }, [clientId]);

  async function loadDashboardData() {
    try {
      const [monitoringRes, requestsRes, interventionsRes, paymentsRes, snapshotsRes] = await Promise.all([
        supabase.from("monitoring_results").select("*").eq("client_id", clientId).order("checked_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("client_requests").select("id, status").eq("client_id", clientId),
        supabase.from("interventions").select("id, status").eq("client_id", clientId),
        supabase.from("payments").select("id, status, amount").eq("client_id", clientId),
        supabase.from("daily_snapshots").select("*").eq("client_id", clientId).order("checked_at", { ascending: false }).limit(14),
      ]);

      const latestMonitoring = monitoringRes.data;
      const requests = requestsRes.data || [];
      const interventions = interventionsRes.data || [];
      const payments = paymentsRes.data || [];
      const snapshots = snapshotsRes.data || [];

      setStats({
        monitoring: latestMonitoring,
        openRequests: requests.filter(r => r.status === "open").length,
        activeInterventions: interventions.filter(i => i.status === "in-progress").length,
        unpaidPayments: payments.filter(p => p.status !== "paid").length,
        totalDue: payments.filter(p => p.status !== "paid").reduce((s, p) => s + Number(p.amount || 0), 0),
        snapshots,
        httpOk: latestMonitoring?.http_status?.ok !== false,
        sslOk: latestMonitoring?.ssl_status?.valid !== false,
        dnsOk: latestMonitoring?.dns_status?.resolved !== false,
      });
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!clientUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Compte non lie</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          Votre compte n'est pas encore associe a un site. Contactez votre administrateur pour configurer l'acces.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusCards = [
    {
      icon: Globe,
      label: "HTTP",
      ok: stats?.httpOk,
      detail: stats?.monitoring?.http_status?.statusCode ? `Status ${stats.monitoring.http_status.statusCode}` : "N/A",
    },
    {
      icon: Shield,
      label: "SSL",
      ok: stats?.sslOk,
      detail: stats?.monitoring?.ssl_status?.daysRemaining ? `${stats.monitoring.ssl_status.daysRemaining}j restants` : "N/A",
    },
    {
      icon: Activity,
      label: "DNS",
      ok: stats?.dnsOk,
      detail: stats?.dnsOk ? "Resolu" : "Probleme",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Vue d'ensemble de l'etat de votre site
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statusCards.map(({ icon: Icon, label, ok, detail }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
              </div>
              {ok ? (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Demandes ouvertes"
          value={stats?.openRequests || 0}
          color="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-900/20"
        />
        <StatCard
          icon={Wrench}
          label="Interventions en cours"
          value={stats?.activeInterventions || 0}
          color="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-900/20"
        />
        <StatCard
          icon={CreditCard}
          label="Factures en attente"
          value={stats?.unpaidPayments || 0}
          suffix={stats?.totalDue > 0 ? ` (${stats.totalDue.toFixed(2)} EUR)` : ""}
          color="text-rose-600"
          bg="bg-rose-50 dark:bg-rose-900/20"
        />
      </div>

      {stats?.snapshots?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Historique recent</h3>
          <div className="flex items-end gap-1 h-16">
            {stats.snapshots.slice(0, 14).reverse().map((snap, i) => {
              const hasIssues = snap.issues && snap.issues.length > 0;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-colors ${hasIssues ? "bg-amber-400 dark:bg-amber-500" : "bg-emerald-400 dark:bg-emerald-500"}`}
                  style={{ height: hasIssues ? "40%" : "100%" }}
                  title={`${snap.snapshot_date} (${snap.slot}) ${hasIssues ? "- Problemes detectes" : "- OK"}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-400">
            <span>Il y a 7 jours</span>
            <span>Aujourd'hui</span>
          </div>
        </div>
      )}

      {stats?.monitoring?.checked_at && (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Derniere analyse : {new Date(stats.monitoring.checked_at).toLocaleString("fr-FR")}
        </p>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix = "", color, bg }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
      <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {value}{suffix}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{label}</p>
    </div>
  );
}
