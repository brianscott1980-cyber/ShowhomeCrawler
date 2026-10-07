import {config} from 'dotenv';config({path:'.env.local',quiet:true});
import {isPlotName} from '../src/reports/home-display';
const {websiteDatabase}=await import('../src/database/website');const sql=websiteDatabase();
const plotPattern='(^|[^a-z])(plot|development|block)([^a-z]|$)|(^|[^a-z0-9])((ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|[0-9]+(st|nd|rd|th)?)[[:space:]]+floor|floor[[:space:]]+[0-9]+|f[[:space:]]*[0-9]+|(type|apartment|property|home)[[:space:]]*[0-9]+)([^a-z0-9]|$)',numberPattern='^[0-9]';
const cards=await sql`select key,name from showhome_web.directory_cards where kind='buildings'`;
const rejected=cards.filter(row=>isPlotName(row.name));console.log(`Removing ${rejected.length} plot-labelled building cards; source galleries retained`);
await sql.begin(async tx=>{
 if(rejected.length){const keys=rejected.map(row=>row.key);await tx`delete from showhome_web.directory_filter_rows where kind='buildings' and card_key=any(${keys}::text[])`;await tx`delete from showhome_web.directory_cards where kind='buildings' and key=any(${keys}::text[])`;}
 await tx`update showhome_web.gallery_card_index set building_names=array(select name from unnest(building_names) name where name !~* ${plotPattern} and name !~ ${numberPattern}) where exists(select 1 from unnest(building_names) name where name ~* ${plotPattern} or name ~ ${numberPattern})`;
 const [count]=await tx`select count(*) as total from showhome_web.directory_cards where kind='buildings' and is_ready`;
 await tx`update showhome_web.presentations set payload=jsonb_set(payload,'{Styles}',to_jsonb(${Number(count.total)}::integer)),updated_at=now() where key='counts:buildings'`;
 await tx`update showhome_web.publication_revision set revision=revision+1 where singleton=true`;await tx`delete from showhome_web.query_cache`;
});await sql.end();
