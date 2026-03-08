const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function checkSiteViaEdge(client, smtpConfig) {
  const apiUrl = `${SUPABASE_URL}/functions/v1/check-site`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client: {
        id: client.id,
        name: client.name,
        url: client.url,
        domain: client.domain,
        tags: client.tags || [],
      },
      smtpConfig: smtpConfig?.host ? smtpConfig : null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur serveur: ${response.status}`);
  }

  return await response.json();
}
