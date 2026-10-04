'use client';
import {useEffect,useRef,useState} from 'react';
import {safeReturnPath} from '../auth/return-path';
import {authClient} from '../auth/browser';
import {getSavedLocation,saveLocation,type SavedLocation} from './location-preferences';
type LocationIntent={key:'radius'|'order';value:string};
const resumeKey='showhome-location-request';
export function useLocationRequest(onResume:(location:SavedLocation,intent:LocationIntent)=>void){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState('');
 const pending=useRef<((location:SavedLocation)=>void)|null>(null);
 const intent=useRef<LocationIntent|null>(null);
 const resume=useRef(onResume);resume.current=onResume;
 useEffect(()=>{
  try{
   const stored=JSON.parse(sessionStorage.getItem(resumeKey)??'null');
   if(!stored||stored.path!==window.location.pathname+window.location.search||Date.now()-stored.created>30*60*1000)return;
   if(!['radius','order'].includes(stored.intent?.key))return;
   sessionStorage.removeItem(resumeKey);intent.current=stored.intent;
   pending.current=location=>resume.current(location,stored.intent);
   setDraft(stored.postcode??'');
   void getSavedLocation().then(location=>{if(location){pending.current?.(location);pending.current=null;}else setOpen(true);});
  }catch{}
 },[]);
 async function requestLocation(action:(location:SavedLocation)=>void,nextIntent:LocationIntent,forceChange=false){
  const saved=await getSavedLocation();if(saved&&!forceChange){action(saved);return;}
  setDraft(saved?.postcode??'');
  pending.current=action;intent.current=nextIntent;setOpen(true);
 }
 function remember(postcode:string){
  sessionStorage.setItem(resumeKey,JSON.stringify({path:window.location.pathname+window.location.search,intent:intent.current,postcode,created:Date.now()}));
 }
 const dialog=<LocationDialog initialPostcode={draft} open={open} onAuthenticate={remember} onCancel={()=>{sessionStorage.removeItem(resumeKey);pending.current=null;setOpen(false);}} onComplete={location=>{sessionStorage.removeItem(resumeKey);pending.current?.(location);pending.current=null;setOpen(false);}}/>;
 return {requestLocation,dialog};
}
export function LocationDialog({open,onCancel,onComplete,onAuthenticate,initialPostcode=''}:{initialPostcode?:string;open:boolean;onCancel:()=>void;onComplete:(location:SavedLocation)=>void;onAuthenticate:(postcode:string)=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 const [postcode,setPostcode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[signedIn,setSignedIn]=useState(false);
 const [authMode,setAuthMode]=useState<'signup'|'signin'|null>(null);
 const alive=useRef(true);
 useEffect(()=>{setPostcode(initialPostcode);},[initialPostcode]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const element=ref.current;if(!element)return;if(open){setMessage('');setAuthMode(null);element.showModal();void authClient().then(async client=>{const {data}=await client.auth.getSession();if(alive.current)setSignedIn(Boolean(data.session));}).catch(()=>setSignedIn(false));}else if(element.open)element.close();},[open]);
 async function authenticate(provider:'google'|'facebook'){
  setBusy(true);setMessage('Connecting…');
  try{
   onAuthenticate(postcode);
   const callback=new URL('/auth/callback',window.location.origin);
   callback.searchParams.set('next',safeReturnPath(window.location.pathname+window.location.search+window.location.hash));
   const {error}=await (await authClient()).auth.signInWithOAuth({provider,options:{redirectTo:callback.href,...(provider==='facebook'?{scopes:'email'}:{})}});
   if(error)throw error;
  }catch{setBusy(false);setMessage('Unable to connect. Please try again.');}
 }
 async function complete(location:SavedLocation){await saveLocation(location);if(alive.current)onComplete(location);}
 async function lookup(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('Looking up postcode…');try{const response=await fetch('/api/location?postcode='+encodeURIComponent(postcode.trim()));const data=await response.json();if(!response.ok)throw new Error(data.error??'Postcode lookup failed.');await complete({...data,source:'postcode'});}catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'Unable to save location.');}finally{if(alive.current)setBusy(false);}}
 function locate(){if(busy)return;if(!navigator.geolocation){setMessage('Device location is unavailable. Enter a postcode instead.');return;}setBusy(true);setMessage('Waiting for your device location…');navigator.geolocation.getCurrentPosition(async p=>{try{await complete({latitude:p.coords.latitude,longitude:p.coords.longitude,source:'browser'});}catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'Unable to save location.');}finally{if(alive.current)setBusy(false);}},error=>{if(alive.current){setBusy(false);setMessage(error.code===1?'Location permission was declined. Enter a postcode instead.':'Location unavailable. Enter a postcode instead.');}},{timeout:15000,maximumAge:300000});}
 return <dialog ref={ref} className="location-request-dialog" aria-labelledby="location-request-title" onCancel={e=>{if(busy)e.preventDefault();else onCancel();}} onClose={()=>{if(open&&!busy)onCancel();}}>
  <div className="location-request-heading"><h2 id="location-request-title">Find homes near you</h2><button type="button" disabled={busy} onClick={onCancel} aria-label="Close location dialog">×</button></div>
  <div className={signedIn?'location-request-columns signed-in':'location-request-columns'}><div className="location-request-form">
  <p>Choose a location to calculate distances and find nearby developments.</p>
  <button className="location-request-device" type="button" disabled={busy} onClick={locate}>Use my device location</button>
  <form onSubmit={lookup}><label htmlFor="location-request-postcode">Or enter your postcode</label><div><input id="location-request-postcode" autoComplete="postal-code" placeholder="e.g. SW1A 1AA" value={postcode} onChange={e=>setPostcode(e.target.value)} maxLength={10} required disabled={busy}/><button disabled={busy}>Use postcode</button></div></form>
  <p className="subtle">{signedIn?'Your location will be saved to your profile.':'We’ll remember your location for 24 hours.'}</p>
  </div>
  {!signedIn&&<section className="location-account-offer" aria-labelledby="location-account-title">
   <h3 id="location-account-title">Make yourself at home</h3>
   <p>Keep your search personal, and your inspiration close.</p>
   <ul><li><strong>Saved preferences</strong> — keep your location across visits.</li><li><strong>Favourites</strong> — collect the homes and interiors you love.</li><li><strong>Notifications</strong> — updates to help you discover more, coming soon.</li></ul>
   <div className="location-account-actions"><button type="button" className="location-account-cta" disabled={busy} onClick={()=>setAuthMode('signup')}>Sign up</button><button type="button" className="location-account-signin" disabled={busy} onClick={()=>setAuthMode('signin')}>Sign in</button></div>
   {authMode&&<div className="location-auth-providers"><p>{authMode==='signin'?'Sign in to continue your search':'Create your account'}</p><button type="button" disabled={busy} onClick={()=>authenticate('google')}>Continue with Google</button>{/* Facebook login temporarily hidden. <button type="button" disabled={busy} onClick={()=>authenticate('facebook')}>Continue with Facebook</button> */}<p className="subtle">You’ll return here to finish finding homes near you.</p></div>}
  </section>}</div>
  <p role="status" className="subtle">{message}</p>
 </dialog>;
}
