import {websiteDatabase} from '../src/database/website';
const sql=websiteDatabase();try{
 console.log('DATABASE',JSON.stringify(await sql`select pg_size_pretty(pg_database_size(current_database())) as size`));
 console.log('TABLES',JSON.stringify(await sql`select n.nspname as schema,c.relname as table,pg_size_pretty(pg_total_relation_size(c.oid)) as total,round(pg_total_relation_size(c.oid)/1048576.0,1) as total_mb,round(pg_table_size(c.oid)/1048576.0,1) as data_toast_mb,round(pg_indexes_size(c.oid)/1048576.0,1) as indexes_mb,coalesce(s.n_live_tup,0) as estimated_rows,coalesce(s.n_dead_tup,0) as estimated_dead_rows from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stat_user_tables s on s.relid=c.oid where c.relkind in('r','m') and n.nspname not in('pg_catalog','information_schema') order by pg_total_relation_size(c.oid) desc limit 20`));
 console.log('INDEXES',JSON.stringify(await sql`select schemaname,relname as table,indexrelname as index,round(pg_relation_size(indexrelid)/1048576.0,1) as mb,idx_scan,pg_get_indexdef(indexrelid) as definition from pg_stat_user_indexes order by pg_relation_size(indexrelid) desc limit 15`));
}finally{await sql.end();}
