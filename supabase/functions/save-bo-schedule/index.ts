import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Convert Paris hour to UTC cron expression
// France is UTC+1 (winter CET) or UTC+2 (summer CEST)
// We use UTC+2 (CEST) as default — close enough year-round for a personal tool
function buildCronExpr(frequency: string, hourParis: number, dayOfWeek: number, dayOfMonth: number): string {
  const hourUtc = (hourParis - 2 + 24) % 24;
  if (frequency === "daily") return `0 ${hourUtc} * * *`;
  if (frequency === "weekly") return `0 ${hourUtc} * * ${dayOfWeek ?? 1}`;
  if (frequency === "monthly") return `0 ${hourUtc} ${dayOfMonth ?? 1} * *`;
  return `0 ${hourUtc} * * 1`; // fallback: weekly Monday
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      enabled,
      frequency,
      hour_paris,
      day_of_week,
      day_of_month,
      alert_threshold,
      alert_recipient,
    } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Upsert schedule config
    const { data: existing } = await supabase
      .from("backoffice_schedule")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const payload = {
      enabled: Boolean(enabled),
      frequency: frequency || "weekly",
      hour_paris: hour_paris ?? 8,
      day_of_week: day_of_week ?? 1,
      day_of_month: day_of_month ?? 1,
      alert_threshold: alert_threshold || "critical",
      alert_recipient: alert_recipient || null,
      updated_at: new Date().toISOString(),
    };

    let schedule;
    if (existing?.id) {
      const { data, error } = await supabase
        .from("backoffice_schedule")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      schedule = data;
    } else {
      const { data, error } = await supabase
        .from("backoffice_schedule")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      schedule = data;
    }

    // Update pg_cron job
    const cronExpr = enabled
      ? buildCronExpr(frequency || "weekly", hour_paris ?? 8, day_of_week ?? 1, day_of_month ?? 1)
      : "";

    const { error: rpcError } = await supabase.rpc("update_self_analyze_cron", {
      p_cron_expr: cronExpr,
    });

    if (rpcError) {
      console.error("Failed to update cron:", rpcError);
    }

    return new Response(
      JSON.stringify({ success: true, schedule, cron_expr: cronExpr || null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("save-bo-schedule error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
