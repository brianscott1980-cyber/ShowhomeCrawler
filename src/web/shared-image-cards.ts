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

/** Keep the first image and combine memberships across builders. */
export function uniqueImageCards(images:GalleryImage[]):GalleryImage[]{
 const cards=new Map<string,GalleryImage>();
 for(const image of images){const previous=cards.get(image.id);const homes=image.homes.map(home=>({...home,builderSlug:home.builderSlug??image.slug,builderName:home.builderName??image.developer}));if(previous)previous.homes.push(...homes);else cards.set(image.id,{...image,imageUid:image.imageUid??image.uid,homes});}
 return [...cards.values()];
}

/** Collection labels describe groups of rooms, while image overlays stay singular. */
export function roomCollectionLabel(value:string){
 const label=roomLabel(value);
 const plurals:Record<string,string>={'Bathroom':'Bathrooms','Bedroom':'Bedrooms','Dining Room':'Dining Rooms','Dressing Room':'Dressing Rooms','Hallway':'Hallways','Home Gym':'Home Gyms','Kitchen':'Kitchens','Living Room':'Living Rooms','Media & Games Room':'Media & Games Rooms','Study & Home Office':'Studies & Home Offices','Toilet':'Toilets','Utility Room':'Utility Rooms','Empty':'Empty Rooms'};
 return plurals[label]??label;
}
