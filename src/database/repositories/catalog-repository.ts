import type { DevelopmentCandidate, PropertyCandidate } from '../../models/domain.js';
export interface CatalogRepository {
 saveDevelopment(development: DevelopmentCandidate, properties: PropertyCandidate[]): Promise<{ developmentId: string; propertiesSaved: number }>;
}
