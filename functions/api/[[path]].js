export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Backend Worker URL (set BACKEND_API_URL in Pages Environment Variables or replace with your Worker domain)
  const backendWorkerUrl = context.env?.BACKEND_API_URL || 'https://your-worker-subdomain.workers.dev';
  const targetUrl = new URL(url.pathname + url.search, backendWorkerUrl);
  
  // Forward request to backend Worker securely from edge
  const modifiedRequest = new Request(targetUrl.toString(), {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'follow'
  });
  
  return fetch(modifiedRequest);
}
