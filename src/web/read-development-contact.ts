import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {developmentContact} from './development-contact';
export async function readDevelopmentContact(url:string){
 const key=createHash('sha256').update(url).digest('hex');
 const html=await readFile(`results/.cache/pages/${key}.html`,'utf8').catch(()=>'');
 return developmentContact(html);
}
