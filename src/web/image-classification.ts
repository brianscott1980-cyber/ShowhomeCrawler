import type {ReportImage} from '../reports/report';
/** A downloaded image needs a named HTML or AI category before appearing publicly. */
export function hasImageCategory(category?:string|null){
 return Boolean(category?.trim())&&!/^(other|uncategorised|uncategorized|unknown|interior|infographic|illustration|promotional graphic|marketing image|document|logo|map)$/i.test(category!.trim());
}
export function isCategorisedImage(image:Pick<ReportImage,'categorisation'|'verdict'>){
 return image.categorisation?hasImageCategory(image.categorisation.mainCategory):Boolean(image.verdict?.matches&&hasImageCategory(image.verdict.roomType));
}

export function isInteriorCategory(category?:string|null){
 return hasImageCategory(category)&&! /^(exterior|floor[ -]?plans?|site plan|garden|patio|balcony|street scene)$/i.test(category!.trim());
}
