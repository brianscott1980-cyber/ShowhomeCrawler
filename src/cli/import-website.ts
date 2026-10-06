import {createDatabase} from '../database/postgres';
import {developers} from '../adapters/developers';
import {importBuilder} from '../catalogue/import';
const sql=createDatabase();
try{
 const selected=process.argv[2];
 for(const builder of developers.filter(b=>!selected||b.slug===selected))console.log(JSON.stringify(await importBuilder(sql,builder.slug)));
}finally{await sql.end();}
