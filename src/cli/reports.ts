import {readFile} from 'node:fs/promises';
import {writeReport} from '../reports/report.js';
import {writeGateway} from '../reports/gateway.js';
for(const folder of ['bellway-home-offices','cala-home-offices'])await writeReport(`results/${folder}`,JSON.parse(await readFile(`results/${folder}/results.json`,'utf8')));
await writeGateway();
