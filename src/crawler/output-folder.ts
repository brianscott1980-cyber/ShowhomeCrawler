import {relative,isAbsolute,sep} from 'node:path';
export function insideResults(root:string,folder:string){const path=relative(root,folder);return Boolean(path)&&!isAbsolute(path)&&path!=='..'&&!path.startsWith('..'+sep);}
