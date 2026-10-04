/** JSON arrays preserve labels containing commas; old single-value URLs still work. */
export function selectedValues(value:string):string[]{
 if(!value)return [];
 if(value.startsWith('[')){try{const values=JSON.parse(value);if(Array.isArray(values))return [...new Set(values.filter((v):v is string=>typeof v==='string'&&v!==''))];}catch{}}
 return [value];
}
export function selectionValue(values:string[]){return values.length===0?'':values.length===1?values[0]!:JSON.stringify(values);}
export function matchesSelection(value:string,candidate:string){const selected=selectedValues(value);return !selected.length||selected.includes(candidate);}
export function matchesAnySelection(value:string,candidates:string[]){return !value||candidates.some(candidate=>matchesSelection(value,candidate));}
