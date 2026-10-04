'use client';
import {useEffect,useState} from 'react';
import {authClient} from '../auth/browser';
export type SavedLocation={latitude:number;longitude:number;postcode?:string;area?:string;source:'postcode'|'browser'};
const key='showhome-location-v1';
const event='showhome-location-changed';
export const guestLocationLifetime=24*60*60*1000;
export function validLocation(value:unknown):SavedLocation|null{
 if(!value||typeof value!=='object')return null;
 const p=value as SavedLocation;
 if(!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180||!['postcode','browser'].includes(p.source))return null;
 if(p.source==='postcode'&&(typeof p.postcode!=='string'||!p.postcode.trim()||p.postcode.length>10))return null;
 return {latitude:p.latitude,longitude:p.longitude,source:p.source,...(p.source==='postcode'?{postcode:p.postcode}: {}),...(typeof p.area==='string'&&p.area.trim()?{area:p.area.trim().slice(0,160)}:{})};
}
export function readGuestLocation():SavedLocation|null{
 try{
  const value=JSON.parse(localStorage.getItem(key)??'null');
  if(!value)return null;
  if(!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now()){localStorage.removeItem(key);return null;}
  return validLocation(value.location);
 }catch{return null;}
}
export async function getSavedLocation():Promise<SavedLocation|null>{
 try{const client=await authClient();const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)return validLocation(data.session.user.user_metadata?.showhome_location);}catch{}
 return readGuestLocation();
}
export async function saveLocation(value:SavedLocation|null):Promise<string>{
 const location=validLocation(value);
 if(value&&!location)throw new Error('Location is invalid.');
 let client;
 try{client=await authClient();}catch{}
 if(client){
  const {data,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw new Error('Unable to check your account. Please try again.');
  if(data.session){
   // Supabase persists user metadata in auth.users.raw_user_meta_data.
   const {error}=await client.auth.updateUser({data:{showhome_location:location}});
   if(error)throw new Error('Your profile could not be updated. Please try again.');
   try{localStorage.removeItem(key);}catch{}
   window.dispatchEvent(new CustomEvent(event,{detail:location}));
   return location?'Location saved to your profile.':'Saved location removed.';
  }
 }
 let stored=true;
 try{if(location)localStorage.setItem(key,JSON.stringify({location,expiresAt:Date.now()+guestLocationLifetime}));else localStorage.removeItem(key);}catch{stored=false;}
 window.dispatchEvent(new CustomEvent(event,{detail:location}));
 return !location?'Saved location removed.':stored?'Saved for 24 hours. Sign up or sign in to keep your preferences across visits.':'Browser storage is unavailable; location is available for this visit. Sign in to keep your preferences.';
}
export function useSavedLocation(){
 const [location,setLocation]=useState<SavedLocation|null>(null);
 useEffect(()=>{
  let alive=true;let unsubscribe:(()=>void)|undefined;let revision=0;let signedIn=false;
  const read=()=>{if(!signedIn)setLocation(readGuestLocation());};
  const changed=(e:Event)=>{revision++;setLocation((e as CustomEvent<SavedLocation|null>).detail);};
  const storage=(e:StorageEvent)=>{if(e.key===key||e.key===null){revision++;read();}};
  read();window.addEventListener(event,changed);window.addEventListener('storage',storage);window.addEventListener('focus',read);
  const timer=setInterval(read,30000);
  void authClient().then(async client=>{
   if(!alive)return;
   const apply=(user:import('@supabase/supabase-js').User|null)=>{if(!alive)return;signedIn=Boolean(user);if(user)setLocation(validLocation(user.user_metadata?.showhome_location));else read();};
   const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{revision++;apply(session?.user??null);});
   unsubscribe=()=>subscription.unsubscribe();
   const initialRevision=revision;const {data}=await client.auth.getSession();if(revision===initialRevision)apply(data.session?.user??null);
  }).catch(()=>{});
  return()=>{alive=false;unsubscribe?.();clearInterval(timer);window.removeEventListener(event,changed);window.removeEventListener('storage',storage);window.removeEventListener('focus',read);};
 },[]);
 return location;
}
