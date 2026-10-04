export function publicAuthConfig(env: Record<string,string|undefined>): {url:string;publishableKey:string}|null {
 const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL;
 const publishableKey=env.SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!publishableKey)return null;
 try{if(new URL(url).protocol!=='https:'&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url))return null;}catch{return null;}
 if(publishableKey.startsWith('sb_secret_'))return null;
 if(!publishableKey.startsWith('sb_publishable_')){
  try{const payload=JSON.parse(Buffer.from(publishableKey.split('.')[1]??'','base64url').toString());if(payload.role!=='anon')return null;}catch{return null;}
 }
 return {url,publishableKey};
}
