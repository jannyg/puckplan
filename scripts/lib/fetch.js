// scripts/lib/fetch.js
import https from 'node:https';

export function parseJsonResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

export async function fetchJson(url, retryOnce = true) {
  const { statusCode, body } = await httpsGet(url);
  if (statusCode === 429 && retryOnce) {
    console.warn('Rate limited (429), retrying after 60s...');
    await new Promise(r => setTimeout(r, 60_000));
    return fetchJson(url, false);
  }
  if (statusCode !== 200) {
    console.warn(`HTTP ${statusCode} for ${url}`);
    return null;
  }
  return parseJsonResponse(body);
}
