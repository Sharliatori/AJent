import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const COOLDOWN_MS = 60_000;

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

    const body = await req.json();
    const projectId = body.project_id;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: project, error: fetchError } = await supabase
      .from("analyzed_projects")
      .select("id, project_name, webhook_url, api_key, last_trigger_at, is_active")
      .eq("id", projectId)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!project.webhook_url) {
      return new Response(
        JSON.stringify({ error: "No webhook URL configured for this project" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (project.last_trigger_at) {
      const elapsed = Date.now() - new Date(project.last_trigger_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        return new Response(
          JSON.stringify({
            error: `Please wait ${remainingSec}s before triggering again`,
            cooldown_remaining: remainingSec,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let webhookResponse: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      webhookResponse = await fetch(project.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${project.api_key}`,
        },
        body: JSON.stringify({
          action: "trigger_analysis",
          project_id: project.id,
          project_name: project.project_name,
          api_key: project.api_key,
          callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/receive-analysis`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
    } catch (fetchErr: any) {
      const isTimeout = fetchErr.name === "AbortError";
      const message = isTimeout
        ? "Webhook timed out after 15 seconds"
        : `Webhook unreachable: ${fetchErr.message}`;

      console.error("Webhook call failed:", message);

      return new Response(
        JSON.stringify({ error: message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("analyzed_projects")
      .update({ last_trigger_at: new Date().toISOString() })
      .eq("id", projectId);

    if (!webhookResponse.ok) {
      return new Response(
        JSON.stringify({
          status: "webhook_error",
          webhook_status: webhookResponse.status,
          project_name: project.project_name,
          error: `Webhook returned HTTP ${webhookResponse.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "triggered",
        webhook_status: webhookResponse.status,
        project_name: project.project_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in trigger-analysis:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
