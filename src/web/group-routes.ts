import type { Group, GroupKind } from './groups';

export const routeSlug = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'collection';
export function groupPrefix(kind: GroupKind) {
 return kind === 'sites'||kind==='locations' ? 'developments' : kind === 'spaces' ? 'interiors' : kind;
}
/** Keep internal grouping keys private; public routes use builder and collection names. */
export function groupRoutes(kind: GroupKind, groups: Group[]) {
 const routes = new Map<string, string>();
 const used = new Set<string>();
 const sorted = [...groups].sort((a, b) => {
  const identity = (group: Group) => group.collections.map(c => `${c.slug}:${c.report.properties[0]?.developmentUrl ?? group.name}`).join('|');
  return identity(a).localeCompare(identity(b)) || a.name.localeCompare(b.name);
 });
 for (const group of sorted) {
  const prefix = groupPrefix(kind);
  const base = `/${prefix}/${prefix === 'interiors' ? '' : `${group.collections[0]!.slug}/`}${routeSlug(group.routeName??group.name)}`;
  let path = base;
  // Rare same-builder, same-name locations remain distinct without exposing hashes.
  if (used.has(path)) {
   const url = group.collections[0]?.report.properties[0]?.developmentUrl;
   const qualifier = url ? routeSlug(new URL(url).pathname) : 'collection';
   path = `${base}-${qualifier}`;
   let suffix = 2;
   while (used.has(path)) path = `${base}-${qualifier}-${suffix++}`;
  }
  used.add(path);
  routes.set(group.key, path);
 }
 return routes;
}
