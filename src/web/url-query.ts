export type SearchValues = Record<string, string | string[] | undefined>;
export function queryString(values: SearchValues) {
 const query = new URLSearchParams();
 for (const [key, value] of Object.entries(values)) {
  for (const item of Array.isArray(value) ? value : [value]) if (item) query.append(key, item);
 }
 const encoded = query.toString();
 return encoded ? `?${encoded}` : '';
}
export function withFilters(path: string, values: SearchValues) { return path + queryString(values); }

