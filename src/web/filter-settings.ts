/** Public because client previews and server queries must use the same mode. */
export function cascadingFiltersEnabled(){
 return process.env.NEXT_PUBLIC_CASCADING_FILTERS==='true';
}
