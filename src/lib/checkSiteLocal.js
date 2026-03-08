// Local implementation of the check-site function for development
export async function checkSiteLocal(client) {
  const issues = [];

  try {
    // HTTP Check
    const start = Date.now();
    const response = await fetch(client.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "AJent Monitor/1.0",
      },
    });
    const responseTime = Date.now() - start;

    const httpStatus = {
      status: response.status,
      responseTime,
      success: true,
      error: null,
    };

    if (response.status !== 200) {
      issues.push(`HTTP ${response.status} (non-200)`);
    }

    if (responseTime > 5000) {
      issues.push(`Temps de réponse lent: ${responseTime}ms`);
    }

    const contentType = response.headers.get("content-type") || "";
    httpStatus.contentType = contentType;

    if (!contentType.includes("text/html")) {
      issues.push(`Type de contenu inattendu: ${contentType}`);
    }

    const html = await response.text();
    httpStatus.contentLength = html.length;

    if (html.length < 100) {
      issues.push("Contenu HTML trop court (possible erreur)");
    }

    if (html.toLowerCase().includes("error") || html.toLowerCase().includes("404")) {
      issues.push("Contenu suspect détecté (error/404)");
    }

    return {
      name: client.name,
      url: client.url,
      domain: client.domain,
      checkedAt: new Date().toISOString(),
      http: httpStatus,
      issues,
      ping: { success: true, latency: responseTime, timestamp: new Date().toISOString() },
      dns: { success: true, hostname: client.domain, records: [], timestamp: new Date().toISOString() },
      ssl: { success: client.url.startsWith('https'), timestamp: new Date().toISOString() },
    };
  } catch (err) {
    return {
      name: client.name,
      url: client.url,
      domain: client.domain,
      checkedAt: new Date().toISOString(),
      http: {
        status: 0,
        responseTime: 0,
        success: false,
        error: err.message,
      },
      issues: [`Erreur HTTP: ${err.message}`],
      ping: { success: false, error: err.message, timestamp: new Date().toISOString() },
      dns: { success: false, error: err.message, timestamp: new Date().toISOString() },
      ssl: { success: false, error: err.message, timestamp: new Date().toISOString() },
    };
  }
}
