import {createDatabase} from '../src/database/postgres';
import {developers,readCollection} from '../src/catalogue/files';
const sql=createDatabase();
try{
 const rows=await sql`select b.slug,(select count(*)::int from showhome_web.images i where i.builder_slug=b.slug) as images,(select count(*)::int from showhome_web.galleries g where g.builder_slug=b.slug) as galleries,(select count(*)::int from showhome_web.gallery_images gi join showhome_web.galleries g on g.key=gi.gallery_key where g.builder_slug=b.slug) as links from showhome_web.builders b`;
 let checked=0;
 for(const builder of developers){const report=await readCollection(builder.slug);if(!report)continue;const row=rows.find(r=>r.slug===builder.slug);const ids=new Set(report.images.map(i=>i.id));const links=report.properties.reduce((sum,p)=>sum+new Set(p.imageIds.filter(id=>ids.has(id))).size,0);if(!row||row.images!==report.images.length||row.galleries!==report.properties.length||row.links!==links)throw new Error('Import parity failed: '+builder.slug);checked++;}
 console.log(`Verified images, galleries and deduplicated gallery links for ${checked} builders`);
}finally{await sql.end();}
