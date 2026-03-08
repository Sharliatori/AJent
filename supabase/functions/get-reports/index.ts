import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "project_id query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: project, error: projectError } = await supabase
      .from("analyzed_projects")
      .select("id")
      .eq("id", projectId)
      .eq("is_active", true)
      .maybeSingle();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { count } = await supabase
      .from("analysis_reports")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    const { data: reports, error: reportsError } = await supabase
      .from("analysis_reports")
      .select("*")
      .eq("project_id", projectId)
      .order("analyzed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (reportsError) {
      console.error("Failed to fetch reports:", reportsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch reports" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportIds = (reports || []).map((r: any) => r.id);

    let dependencies: any[] = [];
    let vulnerabilities: any[] = [];

    if (reportIds.length > 0) {
      const [depsResult, vulnsResult] = await Promise.all([
        supabase
          .from("dependency_snapshots")
          .select("*")
          .in("report_id", reportIds),
        supabase
          .from("vulnerability_findings")
          .select("*")
          .in("report_id", reportIds),
      ]);

      dependencies = depsResult.data || [];
      vulnerabilities = vulnsResult.data || [];
    }

    const enrichedReports = (reports || []).map((report: any) => ({
      ...report,
      dependencies: dependencies.filter((d: any) => d.report_id === report.id),
      vulnerabilities: vulnerabilities.filter((v: any) => v.report_id === report.id),
    }));

    return new Response(
      JSON.stringify({
        reports: enrichedReports,
        total: count || 0,
        limit,
        offset,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in get-reports:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
