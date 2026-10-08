import {it,expect,vi,afterEach} from 'vitest';
const getUser=vi.hoisted(()=>vi.fn());
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser}})}));
import {GET} from '../src/app/api/classifications/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('rejects anonymous requests before loading report files',async()=>{
 expect((await GET(new Request('http://localhost/api/classifications'))).status).toBe(401);
 expect(getUser).not.toHaveBeenCalled();
});
it('verifies the token and rejects another authenticated user',async()=>{
 vi.stubEnv('SUPABASE_URL','https://example.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','sb_publishable_test');
 getUser.mockResolvedValue({data:{user:{id:'another-user'}},error:null});
 expect((await GET(new Request('http://localhost/api/classifications',{headers:{Authorization:'Bearer token'}}))).status).toBe(403);
 expect(getUser).toHaveBeenCalledWith('token');
});
