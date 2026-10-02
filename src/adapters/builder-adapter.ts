import type { DevelopmentCandidate, PropertyCandidate, PropertyDetails, GalleryCandidate } from '../models/domain.js';
export interface BuilderAdapter {
 builderName: string;
 discoverDevelopments(): Promise<DevelopmentCandidate[]>;
 discoverProperties(development: DevelopmentCandidate): Promise<PropertyCandidate[]>;
 getPropertyDetails(candidate: PropertyCandidate): Promise<PropertyDetails>;
 getGallery(property: PropertyDetails): Promise<GalleryCandidate>;
}
