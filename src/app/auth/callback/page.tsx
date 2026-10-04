'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {readGuestLocation,saveLocation} from '../../../web/location-preferences';
import {authClient} from '../../../auth/browser';
import {safeReturnPath} from '../../../auth/return-path';
export default function AuthCallback(){
 const started=useRef(false);const [failed,setFailed]=useState(false),[preferenceError,setPreferenceError]=useState(false),[returnPath,setReturnPath]=useState('/');
 useEffect(()=>{
  if(started.current)return;started.current=true;
  void (async()=>{
   const params=new URLSearchParams(window.location.search);const code=params.get('code');
   const next=safeReturnPath(params.get('next'));
   // Remove the one-time code and provider errors from browser history immediately.
   window.history.replaceState(null,'','/auth/callback');
   if(params.has('error')||!code)throw new Error('Sign-in failed');
   const {data,error}=await (await authClient()).auth.exchangeCodeForSession(code);
   if(error)throw error;
   const guest=readGuestLocation();
   if(guest&&data.user&&!Object.hasOwn(data.user.user_metadata,'showhome_location')){try{await saveLocation(guest);}catch{setReturnPath(next);setPreferenceError(true);return;}}
   window.location.replace(next);
  })().catch(()=>setFailed(true));
 },[]);
 if(preferenceError)return <main className="auth-result"><h1>You’re signed in</h1><p>Your saved location could not be added to your profile. You can save it again from Your profile.</p><Link href={returnPath}>Continue exploring</Link></main>;
 return <main className="auth-result"><h1>{failed?'Unable to sign in':'Signing you in…'}</h1><p>{failed?'Your sign-in was cancelled or could not be completed. Please return to the site and try again.':'You’ll return to the page you were viewing shortly.'}</p>{failed&&<Link href="/">Return to Showhome Explorer</Link>}</main>;
}
