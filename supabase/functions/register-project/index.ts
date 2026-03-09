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
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const projectName = body.project_name?.trim();
    const projectUrl = body.project_url?.trim() || null;
    const webhookUrl = body.webhook_url?.trim() || null;

    if (!projectName) {
      return new Response(
        JSON.stringify({ error: "project_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKey = `ak_${crypto.randomUUID()}`;

    const { data: project, error } = await supabase
      .from("analyzed_projects")
      .insert({
        project_name: projectName,
        project_url: projectUrl,
        webhook_url: webhookUrl,
        api_key: apiKey,
      })
      .select("id, project_name, api_key")
      .single();

    if (error) {
      console.error("Failed to register project:", error);
      return new Response(
        JSON.stringify({ error: "Failed to register project" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        project_id: project.id,
        api_key: project.api_key,
        project_name: project.project_name,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in register-project:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
