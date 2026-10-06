import type {ReportImage} from '../reports/report';
/** A downloaded image needs a named HTML or AI category before appearing publicly. */
export function hasImageCategory(category?:string|null){
 return Boolean(category?.trim())&&!/^(other|uncategorised|uncategorized|unknown|interior)$/i.test(category!.trim());
}
export function isCategorisedImage(image:Pick<ReportImage,'categorisation'|'verdict'>){
 return image.categorisation?hasImageCategory(image.categorisation.mainCategory):Boolean(image.verdict?.matches&&hasImageCategory(image.verdict.roomType));
}
