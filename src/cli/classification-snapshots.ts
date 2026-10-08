import {developers,readCollection} from '../catalogue/files';
import {classificationSnapshot} from '../reports/classification-snapshot';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('classification-reports',{recursive:true});
for(const builder of developers){const report=await readCollection(builder.slug);if(!report)continue;await writeFile(`classification-reports/${builder.slug}.json`,JSON.stringify(classificationSnapshot(builder.slug,report,'Existing catalogue','Existing catalogue; database publication not verified')));}
