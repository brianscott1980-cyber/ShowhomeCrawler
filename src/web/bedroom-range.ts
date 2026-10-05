export const anyBedrooms='any';
export function bedroomRangeOptions(counts:number[],min:string,max:string){
 const numbers=[...new Set([...counts,...[min,max].filter(value=>value&&value!==anyBedrooms).map(Number)])].sort((a,b)=>a-b);
 const minValue=min===anyBedrooms?'':min;
 const maxValue=max===anyBedrooms?'':max;
 return {numbers,minValue,maxValue,maxNumbers:numbers.filter(count=>!minValue||count>=Number(minValue))};
}
