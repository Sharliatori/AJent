import { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../../lib/supabase";
import { CreditCard, Download, CircleCheck as CheckCircle, Clock, TriangleAlert as AlertTriangle } from "lucide-react";

const statusConfig = {
  pending: { label: "En attente", icon: Clock, class: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
  paid: { label: "Payee", icon: CheckCircle, class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  overdue: { label: "En retard", icon: AlertTriangle, class: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function PortalPayments() {
  const { clientUser } = useAuth();
  const clientId = clientUser?.client_id;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    loadPayments();
  }, [clientId]);

  async function loadPayments() {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*, interventions(title)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error("Error loading payments:", err);
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

  const totalDue = payments.filter(p => p.status !== "paid").reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Paiements & Factures</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Suivi de vos factures et paiements
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total en attente</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalDue.toFixed(2)} EUR</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total regle</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalPaid.toFixed(2)} EUR</p>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Aucune facture enregistree.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Description</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Montant</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Echeance</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Statut</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-400">Facture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {payments.map(pay => {
                  const cfg = statusConfig[pay.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900 dark:text-white">{pay.description}</p>
                        {pay.interventions?.title && (
                          <p className="text-xs text-slate-400 mt-0.5">Intervention: {pay.interventions.title}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">
                        {Number(pay.amount).toFixed(2)} {pay.currency}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {pay.due_date ? new Date(pay.due_date).toLocaleDateString("fr-FR") : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${cfg.class}`}>
                          <Icon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {pay.invoice_url ? (
                          <a href={pay.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-xs font-medium">
                            <Download className="w-3.5 h-3.5" />
                            Telecharger
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
