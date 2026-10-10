import {it,expect,vi,afterEach} from 'vitest';
const getUser=vi.hoisted(()=>vi.fn());
const progressQuery=vi.hoisted(()=>vi.fn().mockResolvedValue([]));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser}})}));
vi.mock('../src/database/website',()=>({websiteDatabase:()=>progressQuery}));
import {GET} from '../src/app/api/classifications/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('rejects anonymous requests before loading report files',async()=>{
 expect((await GET(new Request('http://localhost/api/classifications'))).status).toBe(401);
 expect(getUser).not.toHaveBeenCalled();
 expect(progressQuery).not.toHaveBeenCalled();
});
it('verifies the token and rejects another authenticated user',async()=>{
 vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');
 getUser.mockResolvedValue({data:{user:{id:'another-user'}},error:null});
 expect((await GET(new Request('http://localhost/api/classifications',{headers:{Authorization:'Bearer token'}}))).status).toBe(403);
 expect(getUser).toHaveBeenCalledWith('token');
 expect(progressQuery).not.toHaveBeenCalled();
});
it('returns compact independent summaries to the verified owner',async()=>{
 vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');
 getUser.mockResolvedValue({data:{user:{id:'d7428368-8355-4417-b0e7-2059f97e2bd2'}},error:null});
 const response=await GET(new Request('http://localhost/api/classifications',{headers:{Authorization:'Bearer token'}}));
 expect(response.status).toBe(200);
 const data=await response.json();expect(data.summaries.some((s:{phase:string})=>s.phase==='crawl')).toBe(true);expect(data.summaries.some((s:{phase:string})=>s.phase==='classification')).toBe(true);
 expect(data.summaries.every((s:{images?:unknown})=>s.images===undefined)).toBe(true);
 expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('allows anonymous loopback development requests and reads local files without Supabase',async()=>{
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','');
 const response=await GET(new Request('http://127.0.0.1:3000/api/classifications'));
 expect(response.status).toBe(200);expect((await response.json()).localMode).toBe(true);
 expect(getUser).not.toHaveBeenCalled();expect(progressQuery).not.toHaveBeenCalled();
});
it('retains authentication for production and nonlocal requests',async()=>{
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('VERCEL','');
 expect((await GET(new Request('http://localhost/api/classifications'))).status).toBe(401);
 vi.stubEnv('NODE_ENV','development');
 expect((await GET(new Request('https://example.com/api/classifications'))).status).toBe(401);
 vi.stubEnv('VERCEL','1');
 expect((await GET(new Request('http://localhost/api/classifications'))).status).toBe(401);
});
