import {storedFile} from './content-storage';
import {createHash} from 'node:crypto';
import {developmentContact} from './development-contact';
export async function readDevelopmentContact(url:string){
 const key=createHash('sha256').update(url).digest('hex');
 const html=await storedFile(`results/.cache/pages/${key}.html`).then(bytes=>bytes.toString('utf8')).catch(()=>'');
 return developmentContact(html);
}
