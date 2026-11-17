export function cors(req: Request, allowedOrigins = Deno.env.get('ALLOWED_ORIGINS') || '') {
  const origins = allowedOrigins.split(',').map(s=>s.trim()).filter(Boolean);
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': origins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary':'Origin', 'Content-Type':'application/json', 'Cache-Control':'no-store'
  };
}
export function json(body: unknown, status=200, headers={}) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
}
