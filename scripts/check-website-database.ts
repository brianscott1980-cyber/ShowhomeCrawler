import {createDatabase} from '../src/database/postgres';
const sql=createDatabase();
try {
 console.log(JSON.stringify(await sql`select (select count(*) from showhome_web.builders)::int as builders,(select count(*) from showhome_web.developments)::int as developments,(select count(*) from showhome_web.buildings)::int as buildings,(select count(*) from showhome_web.images)::int as images,(select count(*) from showhome_web.galleries)::int as galleries,(select count(*) from showhome_web.gallery_images)::int as links,(select count(*) from showhome_web.offers)::int as offers`));
 console.log(JSON.stringify(await sql`select kind,count(*)::int as cards,sum(pg_column_size(payload))::bigint as bytes from showhome_web.directory_cards group by kind order by kind`));
 console.log(JSON.stringify(await sql`select key,payload from showhome_web.presentations where key like 'counts:%' order by key`));
 console.log(JSON.stringify(await sql`select count(*)::int as unready_visible from showhome_web.directory_cards c where c.kind='locations' and not exists(select 1 from showhome_web.developments d join showhome_web.galleries g on g.development_key=d.key join showhome_web.gallery_images gi on gi.gallery_key=g.key join showhome_web.images i on i.key=gi.image_key where d.builder_slug=c.builder_slug and d.source_url=c.development_url and i.eligible)`));
} finally {await sql.end();}
