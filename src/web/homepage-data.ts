import {readPresentation} from '../database/website';
import type {computeHomepageData} from '../catalogue/homepage-projection';
export type {CoveragePoint,HomePhoto} from '../catalogue/homepage-projection';
export async function homepageData(){return readPresentation<Awaited<ReturnType<typeof computeHomepageData>>>('homepage');}
