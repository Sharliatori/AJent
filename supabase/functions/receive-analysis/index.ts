import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DependencyPayload {
  package_name: string;
  current_version: string;
  latest_version: string;
  latest_patch?: string;
  latest_minor?: string;
  update_type: "patch" | "minor" | "major" | "up-to-date";
  is_deprecated?: boolean;
  days_behind?: number;
}

interface VulnerabilityPayload {
  package_name: string;
  cve_id?: string;
  severity: "low" | "medium" | "high" | "critical";
  description?: string;
  fixed_in_version?: string;
  source_url?: string;
}

interface AnalysisPayload {
  health_score: number;
  total_dependencies: number;
  outdated_count: number;
  vulnerable_count: number;
  deprecated_count: number;
  framework?: string;
  analyzed_at: string;
  dependencies: DependencyPayload[];
  vulnerabilities: VulnerabilityPayload[];
}

function validatePayload(body: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof body.health_score !== "number" || body.health_score < 0 || body.health_score > 100) {
    errors.push("health_score must be a number between 0 and 100");
  }
  if (typeof body.total_dependencies !== "number") {
    errors.push("total_dependencies must be a number");
  }
  if (typeof body.outdated_count !== "number") {
    errors.push("outdated_count must be a number");
  }
  if (typeof body.vulnerable_count !== "number") {
    errors.push("vulnerable_count must be a number");
  }
  if (typeof body.deprecated_count !== "number") {
    errors.push("deprecated_count must be a number");
  }
  if (!body.analyzed_at || isNaN(Date.parse(body.analyzed_at))) {
    errors.push("analyzed_at must be a valid ISO date string");
  }
  if (!Array.isArray(body.dependencies)) {
    errors.push("dependencies must be an array");
  } else {
    for (let i = 0; i < body.dependencies.length; i++) {
      const dep = body.dependencies[i];
      if (!dep.package_name) errors.push(`dependencies[${i}].package_name is required`);
      if (!dep.current_version) errors.push(`dependencies[${i}].current_version is required`);
      if (!dep.latest_version) errors.push(`dependencies[${i}].latest_version is required`);
      if (!["patch", "minor", "major", "up-to-date"].includes(dep.update_type)) {
        errors.push(`dependencies[${i}].update_type must be patch, minor, major, or up-to-date`);
      }
    }
  }
  if (!Array.isArray(body.vulnerabilities)) {
    errors.push("vulnerabilities must be an array");
  } else {
    for (let i = 0; i < body.vulnerabilities.length; i++) {
      const vuln = body.vulnerabilities[i];
      if (!vuln.package_name) errors.push(`vulnerabilities[${i}].package_name is required`);
      if (!["low", "medium", "high", "critical"].includes(vuln.severity)) {
        errors.push(`vulnerabilities[${i}].severity must be low, medium, high, or critical`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const apiKey = authHeader.replace("Bearer ", "").trim();

    if (!apiKey || !apiKey.startsWith("ak_")) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: project, error: projectError } = await supabase
      .from("analyzed_projects")
      .select("id, project_name")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AnalysisPayload = await req.json();
    const validation = validatePayload(body);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: report, error: reportError } = await supabase
      .from("analysis_reports")
      .insert({
        project_id: project.id,
        health_score: body.health_score,
        total_dependencies: body.total_dependencies,
        outdated_count: body.outdated_count,
        vulnerable_count: body.vulnerable_count,
        deprecated_count: body.deprecated_count,
        raw_data: body,
        analyzed_at: body.analyzed_at,
      })
      .select("id")
      .single();

    if (reportError || !report) {
      console.error("Failed to insert report:", reportError);
      return new Response(
        JSON.stringify({ error: "Failed to save report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body.dependencies.length > 0) {
      const depRows = body.dependencies.map((dep) => ({
        report_id: report.id,
        package_name: dep.package_name,
        current_version: dep.current_version,
        latest_version: dep.latest_version,
        latest_patch: dep.latest_patch || null,
        latest_minor: dep.latest_minor || null,
        update_type: dep.update_type,
        is_deprecated: dep.is_deprecated || false,
        days_behind: dep.days_behind || 0,
      }));

      const { error: depError } = await supabase
        .from("dependency_snapshots")
        .insert(depRows);

      if (depError) {
        console.error("Failed to insert dependencies:", depError);
      }
    }

    if (body.vulnerabilities.length > 0) {
      const vulnRows = body.vulnerabilities.map((vuln) => ({
        report_id: report.id,
        package_name: vuln.package_name,
        cve_id: vuln.cve_id || null,
        severity: vuln.severity,
        description: vuln.description || null,
        fixed_in_version: vuln.fixed_in_version || null,
        source_url: vuln.source_url || null,
      }));

      const { error: vulnError } = await supabase
        .from("vulnerability_findings")
        .insert(vulnRows);

      if (vulnError) {
        console.error("Failed to insert vulnerabilities:", vulnError);
      }
    }

    const { error: updateError } = await supabase
      .from("analyzed_projects")
      .update({
        last_health_score: body.health_score,
        last_analysis_at: body.analyzed_at,
        framework: body.framework || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (updateError) {
      console.error("Failed to update project:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, report_id: report.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in receive-analysis:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
