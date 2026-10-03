import {describe,it,expect} from 'vitest';
import {geminiStatusPanel} from '../src/reports/gemini-status.js';
import type {RunReport} from '../src/reports/report.js';
const verdict={matches:true,hasDesk:true,hasBed:false,roomType:'office',description:'Desk beside a window',reason:'Visible desk'};
const report:RunReport={status:'classifying',startedAt:'now',model:'selected',question:'all images',developments:[],properties:[],errors:[],metrics:{},images:[{id:'a',path:'a.jpg',sourceUrl:'a',verdict,analysisModel:'cached-model'},{id:'b',path:'b.jpg',sourceUrl:'b',verdict},{id:'c',path:'c.jpg',sourceUrl:'c'},{id:'d',path:'d.jpg',sourceUrl:'d',verdict:{...verdict,description:'Interior showing styling and furnishings.'},analysisModel:'fabricated'}]};
describe('Gemini report status',()=>{
 it('counts actual model provenance and excludes pending and inferred analyses',()=>{const html=geminiStatusPanel(report);expect(html).toContain('cached-model (1 images)');expect(html).toContain('selected (1 images)');expect(html).not.toContain('fabricated');expect(html).toContain('live worker status unavailable');expect(html).toContain('Automatic fallback models: none');});
 it('shows quota status and safely escapes model and timestamp fields',()=>{const html=geminiStatusPanel({...report,geminiState:{state:'quota_wait',model:'<script>bad</script>',httpStatus:429,updatedAt:'2026-10-03T10:00:00Z',retryAt:'2026-10-03T10:30:00Z'}});expect(html).toContain('Waiting for Gemini quota');expect(html).toContain('HTTP 429');expect(html).toContain('2026-10-03T10:30:00Z');expect(html).not.toContain('<script>');});
});
