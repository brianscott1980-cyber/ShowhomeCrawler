import type { PropertyCandidate, PropertyFilter } from '../models/domain.js';
export function matchesPropertyFilter(property: PropertyCandidate, filter: PropertyFilter): boolean {
 const bounds: [number | null, number | undefined, number | undefined][] = [[property.bedrooms, filter.minBedrooms, filter.maxBedrooms], [property.price, filter.minPrice, filter.maxPrice]];
 for (const [value, minimum, maximum] of bounds) {
  if (minimum !== undefined && (value === null || value === undefined || value < minimum)) return false;
  if (maximum !== undefined && (value === null || value === undefined || value > maximum)) return false;
 }
 if (filter.detachedOnly && property.isDetached !== true) return false;
 if (filter.propertyTypes?.length && (!property.propertyType || !filter.propertyTypes.map(t => t.toLowerCase()).includes(property.propertyType.toLowerCase()))) return false;
 return true;
}
