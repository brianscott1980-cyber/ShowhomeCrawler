import {colourPreview} from './colour-preview';
export function ColourSwatch({label}:{label:string}){
 const background=colourPreview(label);
 return background?<span className="filter-colour-swatch" aria-hidden="true" style={{background}}/>:null;
}
