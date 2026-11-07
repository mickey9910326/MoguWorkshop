export const HOST = 'mabinogi.elden-mogu.com';

// The Worker may only own the site's own pages (with and without the trailing
// slash) plus /_shared/*; everything else on the host belongs to the tunnel.
export function expectedRoutes(pagePaths) {
  const set = new Set([`${HOST}/_shared/*`]);
  for (const p of pagePaths) {
    set.add(HOST + p);
    if (p !== '/' && p.endsWith('/')) set.add(HOST + p.slice(0, -1));
  }
  return set;
}

export function routeProblems(routes, pagePaths) {
  const problems = [];
  const expected = expectedRoutes(pagePaths);
  const seen = new Set();
  for (const r of routes) {
    const pattern = typeof r === 'string' ? r : r.pattern;
    if (typeof r === 'object' && r.custom_domain) problems.push(`custom_domain not allowed: ${pattern}`);
    if (!expected.has(pattern)) problems.push(`unexpected route: ${pattern}`);
    seen.add(pattern);
  }
  for (const e of expected) if (!seen.has(e)) problems.push(`missing route: ${e}`);
  return problems;
}
