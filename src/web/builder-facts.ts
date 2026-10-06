import {readWebsiteBuilder} from '../database/website';
export type BuilderFacts={rating?:{stars:number;score:number;value:number;year:number;source:string;scope?:string};reviews?:{average:number;count:number;sources:{name:string;rating:number;count:number;url:string;checkedAt:string}[]};incentives?:{source:string;checkedAt:string}};
export async function builderFacts(slug:string):Promise<BuilderFacts>{return (await readWebsiteBuilder(slug))?.facts??{};}
