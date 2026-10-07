const colours:Record<string,string>={blue:'#3779c2',green:'#4c8a55',red:'#cc4040',pink:'#e7a0bb',yellow:'#ebcd47',orange:'#e68c37',purple:'#8954a5',violet:'#8751b4',lilac:'#bf9ccc',lavender:'#b9a4d4',teal:'#298b8b',turquoise:'#46b9b2',navy:'#18334f',aqua:'#69c6ce',cyan:'#48bed0',black:'#242424',white:'#fff',grey:'#929292',gray:'#929292',silver:'#bfc4ca',gold:'#c4a052',golden:'#c4a052',bronze:'#a87c4e',copper:'#b87752',brown:'#85654e',beige:'#d6c5a7',cream:'#f3e9cf',neutral:'#d8cdbb',ivory:'#f5f0df',taupe:'#a69588',ochre:'#c39b35',burgundy:'#743448',maroon:'#78383a',coral:'#e98e7b',sage:'#9aaa8b',olive:'#7c854c',terracotta:'#ba765d',charcoal:'#4b4e50'};
/** A representative swatch for the colour words in a classification label. */
export function colourPreview(label:string){
 const values=[...new Set((label.toLowerCase().match(/[a-z]+/g)??[]).flatMap(word=>colours[word]?[colours[word]!]:[]))];
 if(!values.length)return undefined;
 return values.length===1?values[0]:`linear-gradient(90deg,${values.flatMap((value,index)=>[`${value} ${index/values.length*100}%`,`${value} ${(index+1)/values.length*100}%`]).join(',')})`;
}
