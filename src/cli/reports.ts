import {readFile, readdir} from 'node:fs/promises';
import {writeReport} from '../reports/report.js';
import {writeGateway} from '../reports/gateway.js';
for(const entry of await readdir('results',{withFileTypes:true})) {
 if (!entry.isDirectory() || !entry.name.endsWith('-home-offices')) continue;
 try {await writeReport(`results/${entry.name}`,JSON.parse(await readFile(`results/${entry.name}/results.json`,'utf8')));}
 catch(error){if((error as NodeJS.ErrnoException).code !== 'ENOENT')throw error;}
}
await writeGateway();
