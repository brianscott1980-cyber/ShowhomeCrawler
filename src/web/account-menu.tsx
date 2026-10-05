'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {authClient} from '../auth/browser';
import {safeReturnPath} from '../auth/return-path';
export function AccountMenu(){
 const [count,setCount]=useState(0);useEffect(()=>{const read=()=>{try{const value=JSON.parse(localStorage.getItem('showhome-favourites-v1')??'[]');setCount(Array.isArray(value)?new Set(value.filter(v=>typeof v==='string')).size:0);}catch{setCount(0);}};read();window.addEventListener('storage',read);window.addEventListener('showhome-favourites-changed',read);window.addEventListener('pageshow',read);return()=>{window.removeEventListener('storage',read);window.removeEventListener('showhome-favourites-changed',read);window.removeEventListener('pageshow',read);};},[]);

 const [user,setUser]=useState<User|null>(null),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const menu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  let alive=true;let unsubscribe:(()=>void)|undefined;
  void authClient().then(async client=>{
   if(!alive)return;
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(alive)setUser(session?.user??null);});
   unsubscribe=()=>subscription.unsubscribe();
   const {data}=await client.auth.getSession();if(alive)setUser(data.session?.user??null);
  }).catch(()=>{});
  const close=(e:PointerEvent)=>{if(menu.current&&!menu.current.contains(e.target as Node))menu.current.open=false;};
  document.addEventListener('pointerdown',close);
  return()=>{alive=false;unsubscribe?.();document.removeEventListener('pointerdown',close);};
 },[]);
 async function signIn(provider:'google'|'facebook'){
  setBusy(provider);setError('');
  try{
   const client=await authClient();
   const callback=new URL('/auth/callback',window.location.origin);
   callback.searchParams.set('next',safeReturnPath(window.location.pathname+window.location.search+window.location.hash));
   const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:callback.href,...(provider==='facebook'?{scopes:'email'}:{})}});
   if(error)throw error;
  }catch{setError('Unable to sign in right now. Please try again later.');setBusy(null);}
 }
 async function signOut(){
  setBusy('signout');setError('');
  try{const {error}=await (await authClient()).auth.signOut({scope:'local'});if(error)throw error;setUser(null);if(menu.current)menu.current.open=false;}
  catch{setError('Unable to sign out. Please try again.');}finally{setBusy(null);}
 }
 const name=String(user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Account');
 return <details ref={menu} className="account-menu" onKeyDown={event=>{if(event.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
  <summary aria-label={user?`Account: ${name}`:'Sign in to your account'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg><span>{user?name:'Sign in'}</span><span aria-hidden="true">⌄</span></summary>
  <div className="account-panel">
   {user?<><strong>{name}</strong>{user.email&&<p>{user.email}</p>}</>:<><strong>Your account</strong><p>Save your favourites and manage your location preferences.</p></>}
   <Link className="account-action" href="/favourites" onClick={()=>{if(menu.current)menu.current.open=false;}}>Favourites <span className="favourites-count" aria-label={`${count} favourites`}>{count}</span></Link>
   {user&&<Link className="account-action" href="/profile" onClick={()=>{if(menu.current)menu.current.open=false;}}>Your profile</Link>}
   {user?<button type="button" disabled={!!busy} onClick={signOut}>{busy==='signout'?'Signing out…':'Sign out'}</button>:<><button type="button" disabled={!!busy} onClick={()=>signIn('google')}><span className="provider-mark google-mark" aria-hidden="true">G</span>{busy==='google'?'Connecting…':'Continue with Google'}</button>{/* Facebook login temporarily hidden. <button type="button" disabled={!!busy} onClick={()=>signIn('facebook')}><span className="provider-mark facebook-mark" aria-hidden="true">f</span>{busy==='facebook'?'Connecting…':'Continue with Facebook'}</button> */}</>}
   {error&&<p className="account-error" role="alert">{error}</p>}
  </div>
 </details>;
}
