import {builderBrand,brandTextColour} from './builder-brand';
export function BuilderName({name}:{name:string}){
 const brand=builderBrand(name);if(!brand)return <>{name}</>;
 return <bdi className="builder-name">{brand.parts.map((part,i)=><i key={i} style={{font:'inherit',color:brandTextColour(i===0?brand.primary:brand.secondary)}}>{part}</i>)}</bdi>;
}
