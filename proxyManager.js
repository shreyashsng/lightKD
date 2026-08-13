// proxyManager.js - Resilient Multi-Source Proxy Aggregator & Anti-Ban Fetcher
const axios = require('axios');

const DEFAULT_DIRECT_PROXY = "https://kisskh.is/api";
const PROXY_FETCH_INTERVAL = 10 * 60 * 1000; // 10 minutes cache

let cachedProxies = [];
let lastProxyFetchTime = 0;

// Read static PROXY_POOL from environment if specified
function getStaticProxyPool() {
  const rawProxies = process.env.PROXY_POOL
    ? process.env.PROXY_POOL.split(',').map(p => p.trim()).filter(p => p)
    : [];
  return rawProxies.length > 0 ? rawProxies : [DEFAULT_DIRECT_PROXY];
}

// Fetch and aggregate dynamic free HTTP proxies from public feeds
async function refreshDynamicProxies() {
  const now = Date.now();
  if (cachedProxies.length > 0 && (now - lastProxyFetchTime < PROXY_FETCH_INTERVAL)) {
    return cachedProxies;
  }

  const fetchedList = [];

  // Source 1: ProxyScrape
  try {
    const res = await axios.get(
      'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=4000&country=all&ssl=all&anonymity=all',
      { timeout: 3500 }
    );
    const lines = res.data.trim().split('\r\n').filter(p => p && p.includes(':'));
    lines.slice(0, 25).forEach(item => {
      const [host, port] = item.split(':');
      if (host && port) fetchedList.push({ host, port: parseInt(port, 10) });
    });
  } catch (err) {
    console.warn(`[ProxyManager] ProxyScrape feed warning: ${err.message}`);
  }

  // Source 2: Monosans GitHub Proxy List
  try {
    const res = await axios.get(
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      { timeout: 3500 }
    );
    const lines = res.data.trim().split('\n').filter(p => p && p.includes(':'));
    lines.slice(0, 25).forEach(item => {
      const [host, port] = item.split(':');
      if (host && port) fetchedList.push({ host, port: parseInt(port, 10) });
    });
  } catch (err) {
    console.warn(`[ProxyManager] GitHub proxy feed warning: ${err.message}`);
  }

  if (fetchedList.length > 0) {
    const uniqueMap = new Map();
    fetchedList.forEach(p => uniqueMap.set(`${p.host}:${p.port}`, p));
    cachedProxies = Array.from(uniqueMap.values());
    lastProxyFetchTime = now;
    console.log(`[ProxyManager] Aggregated ${cachedProxies.length} dynamic proxies for anti-ban rotation.`);
  }

  return cachedProxies;
}

/**
 * Execute HTTP GET request targeting proxy pool with automatic fallbacks
 * @param {string} endpointPath Relative API endpoint path (e.g. /DramaList/Episode/123.png)
 * @param {object} queryParams Query string parameters object
 * @param {object} customHeaders HTTP Headers to attach
 */
async function fetchFromProxyPool(endpointPath, queryParams = {}, customHeaders = {}) {
  let lastError = null;
  const queryString = new URLSearchParams(queryParams).toString();
  const urlSuffix = queryString ? `${endpointPath}?${queryString}` : endpointPath;

  const staticPool = getStaticProxyPool();
  const shuffledStaticPool = [...staticPool].sort(() => Math.random() - 0.5);

  // Step 1: Try direct / static proxies sequentially (2.5s timeout per attempt)
  for (const proxyBase of shuffledStaticPool) {
    const targetUrl = proxyBase.endsWith('/')
      ? `${proxyBase.slice(0, -1)}${urlSuffix}`
      : `${proxyBase}${urlSuffix}`;

    try {
      const response = await axios.get(targetUrl, {
        headers: customHeaders,
        timeout: 3000
      });
      return response.data;
    } catch (err) {
      let msg = err.message;
      if (err.response) {
        msg += ` (Status ${err.response.status})`;
      }
      lastError = new Error(msg);
    }
  }

  // Step 2: Fallback to dynamic proxy pool race
  const dynamicProxies = await refreshDynamicProxies();
  if (dynamicProxies.length === 0) {
    throw lastError || new Error("All static proxies failed and no dynamic proxies available.");
  }

  const candidates = [...dynamicProxies].sort(() => Math.random() - 0.5).slice(0, 5);
  const directTargetUrl = `https://kisskh.is/api${urlSuffix}`;

  const promises = candidates.map(proxyConf => {
    return axios.get(directTargetUrl, {
      headers: customHeaders,
      timeout: 4500,
      proxy: proxyConf
    }).then(res => res.data);
  });

  try {
    return await Promise.any(promises);
  } catch (aggregateError) {
    throw lastError || new Error("All static and dynamic proxies failed to reach target server.");
  }
}

module.exports = {
  getStaticProxyPool,
  refreshDynamicProxies,
  fetchFromProxyPool
};
