import {it,expect} from 'vitest';
import {publicAuthConfig} from '../src/auth/public-config';
const url='https://example.supabase.co';
it('does not fall back to a service-role key',()=>expect(publicAuthConfig({SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:'secret'})).toBeNull());
it('rejects a secret in the public key setting',()=>expect(publicAuthConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'})).toBeNull());
it('accepts a publishable key',()=>expect(publicAuthConfig({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'})).toEqual({url,publishableKey:'sb_publishable_test'}));
it('rejects a legacy service-role JWT',()=>{const key='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';expect(publicAuthConfig({SUPABASE_URL:url,SUPABASE_ANON_KEY:key})).toBeNull();});
