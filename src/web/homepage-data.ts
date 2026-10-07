import {hasImageCategory,isCategorisedImage} from './image-classification';
import {cachedPresentation} from '../database/presentation-cache';
import type {computeHomepageData} from '../catalogue/homepage-projection';
export type {CoveragePoint,HomePhoto} from '../catalogue/homepage-projection';
export async function homepageData(){const data=await cachedPresentation<Awaited<ReturnType<typeof computeHomepageData>>>('homepage');
 return {...data,hero:data.hero&&hasImageCategory(data.hero.category)?data.hero:null,journeyPhotos:data.journeyPhotos.map(photo=>photo&&hasImageCategory(photo.category)?photo:null),mapPhotos:data.mapPhotos.filter(photo=>hasImageCategory(photo.category)),featured:data.featured.map(collection=>({...collection,report:{...collection.report,images:collection.report.images.filter(isCategorisedImage)}}))};}
