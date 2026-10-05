const firstPrice=100_000,step=25_000;
export function priceRangeOptions(prices:number[]){
 const known=prices.filter(price=>Number.isFinite(price)&&price>=0);
 if(!known.length)return {options:[firstPrice],minimum:'',maximum:''};
 const minimum=Math.max(firstPrice,Math.floor(Math.min(...known)/step)*step);
 const maximum=Math.max(firstPrice,Math.ceil(Math.max(...known)/step)*step);
 return {minimum:String(minimum),maximum:String(maximum),options:Array.from({length:(maximum-firstPrice)/step+1},(_,index)=>firstPrice+index*step)};
}
