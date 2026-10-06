import {createDatabase} from '../database/postgres';
import {websiteDatabase} from '../database/website';
import {publishWebsite} from '../catalogue/publish';
const sql=createDatabase();
try{await publishWebsite(sql);}finally{await sql.end();await websiteDatabase().end();}
