import type {ReportImage} from '../reports/report';
/** A downloaded image needs a named HTML or AI category before appearing publicly. */
export function hasImageCategory(category?:string|null){
 return Boolean(category?.trim())&&!/^(other|uncategorised|uncategorized|unknown|interior|infographic|illustration|promotional graphic|marketing image|document|logo|map)$/i.test(category!.trim());
}
export function isGraphicAsset(image:Pick<ReportImage,'categorisation'|'verdict'>){
 const verdict=image.verdict;
 return /^(graphic|graphic icon|icon|logo|infographic|illustration|advert(?:isement)?|promotional (?:asset|graphic)|marketing image)$/i.test(verdict?.roomType?.trim()??'')||Boolean(verdict?.matches===false&&/graphic icon|promotional asset|graphic.*rather than (?:a )?(?:property|interior|room) photo|infographic|branding asset/i.test(`${verdict.reason??''} ${verdict.description??''}`));
}
export function isCategorisedImage(image:Pick<ReportImage,'categorisation'|'verdict'>){
 if(isGraphicAsset(image))return false;
 return image.categorisation?hasImageCategory(image.categorisation.mainCategory):Boolean(image.verdict?.matches&&hasImageCategory(image.verdict.roomType));
}

export function isInteriorCategory(category?:string|null){
 return hasImageCategory(category)&&! /^(exterior|floor[ -]?plans?|site plan|garden|patio|balcony|street scene)$/i.test(category!.trim());
}
