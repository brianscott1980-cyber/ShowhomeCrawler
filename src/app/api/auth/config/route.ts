import {publicAuthConfig} from '../../../../auth/public-config';
export async function GET() {
 const config=publicAuthConfig(process.env);
 if (!config) return Response.json({error:'Sign-in is not configured.'}, {status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json(config, {headers:{'Cache-Control':'no-store'}});
}
