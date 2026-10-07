import type {ImageCategorisation} from '../reports/report';
export const colourPattern='(^|[^a-z])(blue|green|red|pink|yellow|orange|purple|violet|lilac|lavender|teal|turquoise|navy|aqua|cyan|black|white|grey|gray|silver|gold|golden|bronze|copper|brown|beige|cream|neutral|ivory|taupe|ochre|burgundy|maroon|coral|sage|olive|terracotta|charcoal)([^a-z]|$)';
const colourExpression=new RegExp(colourPattern,'i');
export function interiorTags(cat?:ImageCategorisation){
 const labels=[...cat?.colours??[],...cat?.objects??[],...cat?.chairs??[],...cat?.decor??[],...cat?.wallpaperTags??[],...cat?.curtainTags??[],...cat?.fabricTags??[],...cat?.furnishingTags??[],cat?.wallpaper,cat?.curtains,cat?.hasTelevision?'Television':null,cat?.hasComputer?'Computer':null];
 const tags=[...new Set(labels.filter((s):s is string=>typeof s==='string'&&Boolean(s.trim())).map(s=>s.trim()))].sort((a,b)=>a.localeCompare(b));
 return {colour:tags.filter(t=>colourExpression.test(t)),tag:tags.filter(t=>!colourExpression.test(t))};
}
