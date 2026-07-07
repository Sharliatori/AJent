import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdge(slug, options = {}) {
  const { method = "POST", body } = options;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method,
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const selfAnalyzeService = {
  async runAnalysis(packages, devPackages = []) {
    return callEdge("self-analyze", {
      body: { packages, dev_packages: devPackages, triggered_by: "manual" },
    });
  },

  async getLastRun() {
    const { data, error } = await supabase
      .from("self_analysis_runs")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getHistory(limit = 10) {
    const { data, error } = await supabase
      .from("self_analysis_runs")
      .select("id, triggered_by, status, health_score, deps_total, deps_outdated, vulns_critical, vulns_high, vulns_medium, vulns_low, alert_sent, started_at, completed_at")
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async getSchedule() {
    const { data, error } = await supabase
      .from("backoffice_schedule")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async saveSchedule(config) {
    return callEdge("save-bo-schedule", { body: config });
  },
};
