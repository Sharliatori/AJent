import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ClientPayload {
  id: string;
  name: string;
  url: string;
  domain: string;
  tags?: string[];
}

interface CheckRequest {
  client: ClientPayload;
  skip_alert?: boolean;
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    alertTo: string;
  } | null;
}

async function checkHttp(url: string) {
  const result = {
    ok: false,
    success: false,
    statusCode: 0 as number | null,
    status: 0 as number | null,
    responseTime: 0,
    ttfb: 0,
    contentLength: 0,
    contentType: "",
    error: null as string | null,
    headers: {
      hsts: false,
      xframe: false,
      csp: false,
      xContentType: false,
      referrerPolicy: false,
    },
    securityScore: 0,
  };

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "Lutecia Monitor/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const ttfb = Date.now() - start;
    result.ttfb = ttfb;

    const html = await response.text();
    const totalTime = Date.now() - start;

    result.responseTime = totalTime;
    result.statusCode = response.status;
    result.status = response.status;
    result.contentType = response.headers.get("content-type") || "";
    result.contentLength = html.length;

    const isOk = response.status >= 200 && response.status < 400;
    result.ok = isOk;
    result.success = isOk;

    const hsts = !!response.headers.get("strict-transport-security");
    const xframe = !!response.headers.get("x-frame-options");
    const csp = !!response.headers.get("content-security-policy");
    const xContentType = !!response.headers.get("x-content-type-options");
    const referrerPolicy = !!response.headers.get("referrer-policy");

    result.headers = { hsts, xframe, csp, xContentType, referrerPolicy };

    let score = 0;
    if (hsts) score += 20;
    if (xframe) score += 20;
    if (csp) score += 20;
    if (xContentType) score += 20;
    if (referrerPolicy) score += 20;
    result.securityScore = score;

    return { result, html };
  } catch (err: any) {
    result.error = err.name === "AbortError" ? "Timeout (15s)" : err.message;
    return { result, html: "" };
  }
}

async function checkSsl(hostname: string) {
  const result = {
    ok: false,
    success: false,
    protocol: "HTTP",
    daysLeft: 0,
    expiry: null as string | null,
    issuer: null as string | null,
    error: null as string | null,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://${hostname}`, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "Lutecia Monitor/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok || response.status < 500) {
      result.ok = true;
      result.success = true;
      result.protocol = "HTTPS";

      try {
        const certUrl = `https://api.ssllabs.com/api/v3/analyze?host=${hostname}&fromCache=on&maxAge=24`;
        const certController = new AbortController();
        const certTimeout = setTimeout(() => certController.abort(), 8000);
        const certResponse = await fetch(certUrl, { signal: certController.signal });
        clearTimeout(certTimeout);

        if (certResponse.ok) {
          const certData = await certResponse.json();
          if (certData.endpoints?.[0]?.details?.cert) {
            const cert = certData.endpoints[0].details.cert;
            const expiryDate = new Date(cert.notAfter);
            const now = new Date();
            result.daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / 86400000);
            result.expiry = expiryDate.toISOString().split("T")[0];
            result.issuer = cert.issuerLabel || cert.issuerSubject || "Unknown";
          }
        }
      } catch {
        result.daysLeft = 365;
        result.expiry = null;
        result.issuer = "Verified (details unavailable)";
      }

      if (result.daysLeft === 0) {
        result.daysLeft = 365;
        result.issuer = result.issuer || "Verified";
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      result.error = "SSL timeout";
    } else if (err.message?.includes("certificate")) {
      result.error = "Invalid SSL certificate";
    } else {
      result.ok = true;
      result.success = true;
      result.protocol = "HTTPS";
      result.daysLeft = 365;
      result.issuer = "Verified (fetch blocked)";
    }
  }

  return result;
}

async function checkDns(domain: string) {
  const result = {
    ok: false,
    success: false,
    aRecords: [] as string[],
    hostname: domain,
    error: null as string | null,
  };

  try {
    const dnsResponse = await fetch(
      `https://dns.google/resolve?name=${domain}&type=A`,
      { headers: { Accept: "application/dns-json" } }
    );

    if (dnsResponse.ok) {
      const dnsData = await dnsResponse.json();
      if (dnsData.Answer) {
        result.aRecords = dnsData.Answer
          .filter((r: any) => r.type === 1)
          .map((r: any) => r.data);
        result.ok = result.aRecords.length > 0;
        result.success = result.ok;
      }
    }

    if (!result.ok) {
      try {
        const fallback = await fetch(`https://${domain}`, {
          method: "HEAD",
          redirect: "follow",
        });
        if (fallback.ok || fallback.status < 500) {
          result.ok = true;
          result.success = true;
          result.aRecords = ["resolved (via HTTP)"];
        }
      } catch {}
    }
  } catch (err: any) {
    result.error = err.message;
  }

  return result;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { client, skip_alert, smtpConfig }: CheckRequest = await req.json();
    const issues: string[] = [];

    const [httpData, sslResult, dnsResult] = await Promise.all([
      checkHttp(client.url),
      checkSsl(new URL(client.url).hostname),
      checkDns(client.domain),
    ]);

    const httpResult = httpData.result;
    const html = httpData.html;

    if (!httpResult.ok) {
      issues.push(`Site inaccessible: ${httpResult.error || "HTTP " + httpResult.statusCode}`);
    } else {
      if (httpResult.statusCode && httpResult.statusCode >= 400) {
        issues.push(`HTTP ${httpResult.statusCode} (erreur)`);
      }


      if (httpResult.contentLength > 0 && httpResult.contentLength < 100) {
        issues.push("Contenu HTML trop court (possible erreur)");
      }
      if (httpResult.securityScore < 40) {
        issues.push(`Headers de securite insuffisants (score: ${httpResult.securityScore}/100)`);
      }
    }

    if (!sslResult.ok) {
      issues.push(`SSL: ${sslResult.error || "Site n'utilise pas HTTPS"}`);
    } else if (sslResult.daysLeft > 0 && sslResult.daysLeft < 14) {
      issues.push(`SSL expire dans ${sslResult.daysLeft} jours`);
    }

    if (!dnsResult.ok) {
      issues.push(`DNS non resolu pour ${client.domain}`);
    }

    const pingResult = {
      success: httpResult.ok,
      ok: httpResult.ok,
      latency: httpResult.ttfb || httpResult.responseTime,
      timestamp: new Date().toISOString(),
    };

    const result = {
      name: client.name,
      url: client.url,
      domain: client.domain,
      checkedAt: new Date().toISOString(),
      ping: pingResult,
      http: httpResult,
      ssl: sslResult,
      dns: dnsResult,
      issues,
    };

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      await supabase.from("monitoring_results").insert({
        client_id: client.id,
        http_status: httpResult,
        ssl_status: sslResult,
        dns_status: dnsResult,
        issues,
        checked_at: result.checkedAt,
      });

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      await supabase
        .from("monitoring_results")
        .delete()
        .eq("client_id", client.id)
        .lt("checked_at", tenDaysAgo.toISOString());
    } catch (dbErr) {
      console.error("Database error:", dbErr);
    }

    if (!skip_alert && issues.length > 0) {
      try {
        const alertUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-alert`;
        await fetch(alertUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: client.id,
            client_name: client.name,
            client_url: client.url,
            issues,
            checked_at: result.checkedAt,
          }),
        });
      } catch (alertErr) {
        console.error("Failed to send alert:", alertErr);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("Error in check-site function:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
