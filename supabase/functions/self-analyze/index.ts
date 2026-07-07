import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Version utilities ────────────────────────────────────────────────────────

function extractVersion(v: string): string {
  return v.replace(/^[~^>=<*]+/, "").trim() || "0.0.0";
}

function compareVersions(current: string, latest: string): "up-to-date" | "patch" | "minor" | "major" {
  if (!current || !latest || current === latest) return "up-to-date";
  const curr = current.split("-")[0].split(".").map(Number);
  const lat = latest.split("-")[0].split(".").map(Number);
  if (isNaN(curr[0]) || isNaN(lat[0])) return "patch";
  if ((lat[0] || 0) > (curr[0] || 0)) return "major";
  if ((lat[0] || 0) === (curr[0] || 0) && (lat[1] || 0) > (curr[1] || 0)) return "minor";
  if ((lat[0] || 0) === (curr[0] || 0) && (lat[1] || 0) === (curr[1] || 0) && (lat[2] || 0) > (curr[2] || 0)) return "patch";
  return "up-to-date";
}

// ─── npm registry ─────────────────────────────────────────────────────────────

async function fetchNpmInfo(name: string): Promise<{ latest: string; deprecated: string | null }> {
  try {
    const encoded = name.startsWith("@") ? name : name;
    const res = await fetch(`https://registry.npmjs.org/${encoded}`, {
      headers: { "Accept": "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { latest: "unknown", deprecated: null };
    const data = await res.json();
    const latest = data["dist-tags"]?.latest || "unknown";
    const deprecated = data.versions?.[latest]?.deprecated || null;
    return { latest, deprecated };
  } catch {
    return { latest: "unknown", deprecated: null };
  }
}

// ─── OSV vulnerability lookup ─────────────────────────────────────────────────

interface OsvVuln {
  id: string;
  summary: string;
  severity: string;
  cve_id: string | null;
  description: string;
  fixed_in: string | null;
  url: string | null;
}

function parseOsvSeverity(vuln: any): string {
  const db = vuln.database_specific?.severity?.toLowerCase();
  if (db && ["critical","high","medium","low"].includes(db)) return db;
  for (const sev of vuln.severity || []) {
    if (sev.type === "CVSS_V3" || sev.type === "CVSS_V4") {
      const parts = sev.score.split("/AV:");
      if (parts.length > 0) {
        const baseMetrics = sev.score;
        if (baseMetrics.includes("CVSS:3") || baseMetrics.includes("CVSS:4")) {
          return "high";
        }
      }
    }
  }
  return "medium";
}

function parseFixedIn(vuln: any, pkgName: string): string | null {
  for (const affected of vuln.affected || []) {
    if (affected.package?.name === pkgName) {
      for (const range of affected.ranges || []) {
        for (const event of range.events || []) {
          if (event.fixed) return event.fixed;
        }
      }
    }
  }
  return null;
}

async function fetchVulnerabilities(
  packages: { name: string; version: string }[]
): Promise<Map<string, OsvVuln[]>> {
  const vulnMap = new Map<string, OsvVuln[]>();
  if (packages.length === 0) return vulnMap;

  try {
    const res = await fetch("https://api.osv.dev/v1/querybatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: packages.map((p) => ({
          package: { name: p.name, ecosystem: "npm" },
          version: p.version,
        })),
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return vulnMap;
    const data = await res.json();

    (data.results || []).forEach((result: any, i: number) => {
      const pkgName = packages[i].name;
      const seenKeys = new Set<string>();
      const vulns: OsvVuln[] = [];
      for (const v of result.vulns || []) {
        const cveId = v.aliases?.find((a: string) => a.startsWith("CVE-")) || null;
        // Deduplicate: prefer CVE key, fall back to OSV id
        const dedupeKey = cveId || v.id;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);
        vulns.push({
          id: v.id,
          summary: v.summary || "",
          severity: parseOsvSeverity(v),
          cve_id: cveId,
          description: v.details || v.summary || "",
          fixed_in: parseFixedIn(v, pkgName),
          url: `https://osv.dev/vulnerability/${v.id}`,
        });
      }
      if (vulns.length > 0) vulnMap.set(pkgName, vulns);
    });
  } catch {
    // OSV unavailable — continue without vulnerability data
  }

  return vulnMap;
}

// ─── Health score ─────────────────────────────────────────────────────────────

function computeHealthScore(
  total: number,
  outdated: number,
  vulnCritical: number,
  vulnHigh: number,
  vulnMedium: number,
  deprecated: number
): number {
  if (total === 0) return 100;
  let score = 100;
  // Outdated penalty: max 30pts
  score -= Math.round((outdated / total) * 30);
  // Vulnerability penalty: capped per severity category, not per occurrence
  score -= Math.min(25, vulnCritical * 12);
  score -= Math.min(15, vulnHigh * 6);
  score -= Math.min(8, vulnMedium * 2);
  // Deprecated penalty: max 10pts
  score -= Math.round((deprecated / total) * 10);
  return Math.max(0, Math.min(100, score));
}

// ─── Email alert ──────────────────────────────────────────────────────────────

async function sendVulnAlert(
  supabase: any,
  recipient: string,
  vulnsByPkg: Map<string, OsvVuln[]>,
  healthScore: number,
  threshold: string
) {
  const { data: smtpRow } = await supabase
    .from("smtp_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!smtpRow?.host) return false;

  const relevantVulns: { pkg: string; vuln: OsvVuln }[] = [];
  vulnsByPkg.forEach((vulns, pkg) => {
    for (const v of vulns) {
      if (threshold === "critical" && v.severity !== "critical") continue;
      if (threshold === "high" && !["critical","high"].includes(v.severity)) continue;
      relevantVulns.push({ pkg, vuln: v });
    }
  });

  if (relevantVulns.length === 0) return false;

  const rows = relevantVulns.map(({ pkg, vuln }) => {
    const color = vuln.severity === "critical" ? "#dc2626" : vuln.severity === "high" ? "#f59e0b" : "#6b7280";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${pkg}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
        <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">${vuln.severity}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${vuln.cve_id || vuln.id}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px">${(vuln.summary || "").substring(0, 80)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#10b981">${vuln.fixed_in || "—"}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Alerte Sécurité — Lutecia Dashboard</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:700px;margin:32px auto;padding:0 16px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.08)">
      <div style="background:#dc2626;padding:24px 32px">
        <div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:4px">⚠ Alerte Sécurité — Lutecia Dashboard</div>
        <p style="color:#fca5a5;font-size:12px;margin:0">Analyse automatique · Score de santé : ${healthScore}/100</p>
      </div>
      <div style="padding:24px 32px">
        <p style="color:#374151;font-size:14px;margin:0 0 20px">
          <strong>${relevantVulns.length} vulnérabilité${relevantVulns.length > 1 ? "s" : ""}</strong>
          ${threshold === "critical" ? "critiques" : threshold === "high" ? "critiques ou hautes" : ""}
          ont été détectées dans les dépendances du dashboard Lutecia.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Package</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Sévérité</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">CVE / ID</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Description</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Corrigé dans</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:20px;padding:12px 16px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
          Accédez au backoffice Lutecia pour générer un plan de mise à jour bolt.new.
        </div>
      </div>
      <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center">
        <p style="margin:0;font-size:12px;color:#9ca3af">Lutecia Monitoring · Alerte de sécurité automatique</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const transporter = nodemailer.createTransport({
      host: smtpRow.host,
      port: smtpRow.port ?? 587,
      secure: smtpRow.port === 465,
      auth: { user: smtpRow.smtp_user, pass: smtpRow.smtp_pass },
    });
    await transporter.sendMail({
      from: `"Lutecia Monitoring" <${smtpRow.smtp_user}>`,
      to: recipient,
      subject: `[SÉCURITÉ] Lutecia Dashboard — ${relevantVulns.length} vulnérabilité${relevantVulns.length > 1 ? "s" : ""} détectée${relevantVulns.length > 1 ? "s" : ""}`,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const triggeredBy: string = body.triggered_by || "manual";
    let rawPackages: Record<string, string> = body.packages || {};

    // For scheduled runs with no packages: use last run's package list
    if (triggeredBy === "scheduled" && Object.keys(rawPackages).length === 0) {
      const { data: lastRun } = await supabase
        .from("self_analysis_runs")
        .select("raw_results")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRun?.raw_results?.packages) {
        rawPackages = lastRun.raw_results.packages;
      } else {
        return new Response(
          JSON.stringify({ error: "No previous run found for scheduled analysis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (Object.keys(rawPackages).length === 0) {
      return new Response(
        JSON.stringify({ error: "packages is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: no run in last 3 minutes
    const { data: lastRun } = await supabase
      .from("self_analysis_runs")
      .select("started_at, status")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun?.status === "running") {
      return new Response(
        JSON.stringify({ error: "Analysis already in progress" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (triggeredBy === "manual" && lastRun?.started_at) {
      const msSince = Date.now() - new Date(lastRun.started_at).getTime();
      if (msSince < 3 * 60 * 1000) {
        return new Response(
          JSON.stringify({ error: "Analysis was run recently, please wait a moment" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Insert running status
    const { data: runRow, error: insertError } = await supabase
      .from("self_analysis_runs")
      .insert({ triggered_by: triggeredBy, status: "running" })
      .select("id")
      .single();

    if (insertError || !runRow) {
      return new Response(
        JSON.stringify({ error: "Failed to create analysis run" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runId = runRow.id;

    // Build packages list with cleaned versions
    const pkgList = Object.entries(rawPackages).map(([name, version]) => ({
      name,
      version: extractVersion(version as string),
      isDev: body.devPackages ? (body.devPackages as string[]).includes(name) : false,
    }));

    // Concurrent npm registry lookups
    const npmResults = await Promise.all(pkgList.map(async (p) => ({
      ...p,
      npmInfo: await fetchNpmInfo(p.name),
    })));

    // Batch OSV vulnerability check
    const osvPackages = pkgList.map((p) => ({ name: p.name, version: p.version }));
    const vulnsByPkg = await fetchVulnerabilities(osvPackages);

    // Build dependency records
    const dependencies = npmResults.map((pkg) => {
      const updateType = compareVersions(pkg.version, pkg.npmInfo.latest);
      const packageVulns = vulnsByPkg.get(pkg.name) || [];
      return {
        name: pkg.name,
        current: pkg.version,
        latest: pkg.npmInfo.latest,
        update_type: updateType,
        is_deprecated: !!pkg.npmInfo.deprecated,
        is_dev: pkg.isDev,
        vuln_count: packageVulns.length,
        has_critical: packageVulns.some((v) => v.severity === "critical"),
      };
    });

    // Build vulnerability records
    const vulnerabilities: any[] = [];
    vulnsByPkg.forEach((vulns, pkg) => {
      vulns.forEach((v) => {
        vulnerabilities.push({ package_name: pkg, ...v });
      });
    });

    // Sort vulns by severity
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    vulnerabilities.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    // Compute stats
    const depsTotal = dependencies.length;
    const depsOutdated = dependencies.filter((d) => d.update_type !== "up-to-date").length;
    const depsDeprecated = dependencies.filter((d) => d.is_deprecated).length;
    const vulnCritical = vulnerabilities.filter((v) => v.severity === "critical").length;
    const vulnHigh = vulnerabilities.filter((v) => v.severity === "high").length;
    const vulnMedium = vulnerabilities.filter((v) => v.severity === "medium").length;
    const vulnLow = vulnerabilities.filter((v) => v.severity === "low").length;

    const healthScore = computeHealthScore(
      depsTotal, depsOutdated, vulnCritical, vulnHigh, vulnMedium, depsDeprecated
    );

    const rawResults = {
      packages: rawPackages,
      health_score: healthScore,
      total: depsTotal,
      outdated: depsOutdated,
      deprecated: depsDeprecated,
      dependencies,
      vulnerabilities,
    };

    // Update run to completed
    await supabase.from("self_analysis_runs").update({
      status: "completed",
      health_score: healthScore,
      deps_total: depsTotal,
      deps_outdated: depsOutdated,
      vulns_critical: vulnCritical,
      vulns_high: vulnHigh,
      vulns_medium: vulnMedium,
      vulns_low: vulnLow,
      raw_results: rawResults,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    // Update schedule last_run_at
    await supabase.from("backoffice_schedule")
      .update({ last_run_at: new Date().toISOString() })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows

    // Send alert if needed
    let alertSent = false;
    if (triggeredBy === "scheduled") {
      const { data: scheduleRow } = await supabase
        .from("backoffice_schedule")
        .select("alert_threshold, alert_recipient, enabled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scheduleRow?.alert_recipient) {
        const threshold = scheduleRow.alert_threshold || "critical";
        let shouldAlert = false;
        if (threshold === "critical" && vulnCritical > 0) shouldAlert = true;
        if (threshold === "high" && (vulnCritical + vulnHigh) > 0) shouldAlert = true;
        if (threshold === "all" && vulnerabilities.length > 0) shouldAlert = true;

        if (shouldAlert) {
          alertSent = await sendVulnAlert(
            supabase, scheduleRow.alert_recipient, vulnsByPkg, healthScore, threshold
          );
          if (alertSent) {
            await supabase.from("self_analysis_runs")
              .update({ alert_sent: true }).eq("id", runId);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      health_score: healthScore,
      deps_total: depsTotal,
      deps_outdated: depsOutdated,
      vulns_critical: vulnCritical,
      vulns_high: vulnHigh,
      vulns_medium: vulnMedium,
      vulns_low: vulnLow,
      alert_sent: alertSent,
      dependencies,
      vulnerabilities,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("self-analyze error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
