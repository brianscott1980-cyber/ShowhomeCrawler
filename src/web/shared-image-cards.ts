import type {GalleryImage} from './gallery-page-data';
import {homeTypeName} from '../reports/home-display';
/** One image/house-type entry; repeated development or plot memberships stay together. */
export function sharedImageCards(image:GalleryImage):GalleryImage[]{
 const types=new Map<string,GalleryImage['homes']>();
 for(const home of image.homes){const key=homeTypeName(home.name).toLowerCase();const homes=types.get(key)??[];homes.push(home);types.set(key,homes);}
 if(types.size<2)return [{...image,imageUid:image.uid}];
 return [...types].map(([type,homes])=>({...image,imageUid:image.uid,uid:`${image.uid}:house:${type}`,homes}));
}
export function roomLabel(value:string){return /^empty(?: room)?$/i.test(value.trim())?'Empty':value;}
