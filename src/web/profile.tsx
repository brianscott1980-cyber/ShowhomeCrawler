'use client';
import {LocationLabel} from './location-label';
import {useEffect,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {authClient} from '../auth/browser';
import {saveLocation,useSavedLocation} from './location-preferences';
export function Profile(){
 const location=useSavedLocation();
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[postcode,setPostcode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{setPostcode(location?.postcode??'');},[location]);
 useEffect(()=>{let alive=true;let unsubscribe:(()=>void)|undefined;void authClient().then(async client=>{if(!alive)return;const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(alive){setUser(session?.user??null);setLoading(false);}});unsubscribe=()=>subscription.unsubscribe();const {data}=await client.auth.getSession();if(alive){setUser(data.session?.user??null);setLoading(false);}}).catch(()=>{if(alive)setLoading(false);});return()=>{alive=false;unsubscribe?.();};},[]);
 async function lookup(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('Looking up postcode…');try{const response=await fetch('/api/location?postcode='+encodeURIComponent(postcode.trim()));const data=await response.json();if(!response.ok)throw new Error(data.error??'Postcode lookup failed.');setMessage(await saveLocation({...data,source:'postcode'}));}catch(error){setMessage(error instanceof Error?error.message:'Unable to save location.');}finally{setBusy(false);}}
 function locate(){if(busy)return;if(!navigator.geolocation){setMessage('Browser location is unavailable. Enter a postcode instead.');return;}setBusy(true);setMessage('Waiting for your location permission…');navigator.geolocation.getCurrentPosition(async p=>{try{setMessage(await saveLocation({latitude:p.coords.latitude,longitude:p.coords.longitude,source:'browser'}));}catch(error){setMessage(error instanceof Error?error.message:'Unable to save location.');}finally{setBusy(false);}},()=>{setBusy(false);setMessage('Location unavailable. Enter a postcode instead.');},{timeout:15000,maximumAge:300000});}
 async function clear(){setBusy(true);try{setMessage(await saveLocation(null));}catch(error){setMessage(error instanceof Error?error.message:'Unable to remove location.');}finally{setBusy(false);}}
 return <main className="profile-page">
  <section className="intro compact"><h1>Your profile</h1><p>Keep your details and location preferences together.</p></section>
  <div className="profile-grid">
   <section className="profile-panel" aria-labelledby="profile-details"><h2 id="profile-details">Your details</h2>{loading?<p role="status">Loading your details…</p>:user?<dl><dt>Name</dt><dd>{String(user.user_metadata?.full_name||user.user_metadata?.name||'Not provided')}</dd><dt>Email</dt><dd>{user.email||'Not provided'}</dd></dl>:<p>Sign in using the account menu to see your name and email and save your location to your profile.</p>}</section>
   <section className="profile-panel" aria-labelledby="profile-location"><h2 id="profile-location">Location preferences</h2><p>{location?<LocationLabel location={location}/>:'No saved location yet.'}</p><p className="subtle">{user?'Your location is saved to your profile and reused across Builders and Developments.':'Your location is remembered for 24 hours. Sign up or sign in to keep your preferences across visits.'}</p><form onSubmit={lookup}><label htmlFor="profile-postcode">Your postcode</label><div className="profile-postcode"><input id="profile-postcode" autoComplete="postal-code" placeholder="e.g. SW1A 1AA" required maxLength={10} value={postcode} onChange={e=>setPostcode(e.target.value)} disabled={busy}/><button disabled={busy}>Save postcode</button></div></form><div className="actions"><button type="button" disabled={busy} onClick={locate}>Use my location</button>{location&&<button className="secondary" type="button" disabled={busy} onClick={clear}>Remove saved location</button>}</div><p role="status" className="subtle">{message}</p></section>
  </div>
 </main>;
}
