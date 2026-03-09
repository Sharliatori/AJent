import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction(functionName, options = {}) {
  const { method = "POST", body, queryParams } = options;

  let url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const headers = {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };

  const fetchOptions = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Edge function error: ${response.status}`);
  }

  return data;
}

export const analyzedProjectsService = {
  async getAll() {
    const { data, error } = await supabase
      .from("analyzed_projects")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("analyzed_projects")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async register(projectName, projectUrl, webhookUrl) {
    return callEdgeFunction("register-project", {
      body: {
        project_name: projectName,
        project_url: projectUrl || null,
        webhook_url: webhookUrl || null,
      },
    });
  },

  async triggerAnalysis(projectId) {
    return callEdgeFunction("trigger-analysis", {
      body: { project_id: projectId },
    });
  },

  async softDelete(projectId) {
    return callEdgeFunction("delete-project", {
      method: "DELETE",
      body: { project_id: projectId },
    });
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from("analyzed_projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export const analysisReportsService = {
  async getByProject(projectId, limit = 10, offset = 0) {
    return callEdgeFunction("get-reports", {
      method: "GET",
      queryParams: {
        project_id: projectId,
        limit: String(limit),
        offset: String(offset),
      },
    });
  },

  async getLatest(projectId) {
    const { data, error } = await supabase
      .from("analysis_reports")
      .select("*")
      .eq("project_id", projectId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getScoreHistory(projectId, limit = 12) {
    const { data, error } = await supabase
      .from("analysis_reports")
      .select("id, health_score, total_dependencies, outdated_count, vulnerable_count, deprecated_count, analyzed_at")
      .eq("project_id", projectId)
      .order("analyzed_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

export const dependencySnapshotsService = {
  async getByReport(reportId) {
    const { data, error } = await supabase
      .from("dependency_snapshots")
      .select("*")
      .eq("report_id", reportId)
      .order("package_name", { ascending: true });
    if (error) throw error;
    return data || [];
  },
};

export const vulnerabilityFindingsService = {
  async getByReport(reportId) {
    const { data, error } = await supabase
      .from("vulnerability_findings")
      .select("*")
      .eq("report_id", reportId)
      .order("severity", { ascending: true });
    if (error) throw error;
    return data || [];
  },
};
