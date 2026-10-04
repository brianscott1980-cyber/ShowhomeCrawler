import {beforeEach,describe,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({getSession:vi.fn(),updateUser:vi.fn()}));
vi.mock('../src/auth/browser',()=>({authClient:async()=>({auth})}));
import {saveLocation,validLocation,readGuestLocation,guestLocationLifetime} from '../src/web/location-preferences';
const location={latitude:51.5,longitude:-0.1,postcode:'SW1A 1AA',source:'postcode' as const};
beforeEach(()=>{
 const values=new Map<string,string>();
 vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});
 vi.stubGlobal('window',new EventTarget());
 auth.getSession.mockReset().mockResolvedValue({data:{session:null},error:null});
 auth.updateUser.mockReset().mockResolvedValue({error:null});
});
describe('saved location preferences',()=>{
 it('rejects invalid coordinates and postcode data',()=>{expect(validLocation({...location,latitude:91})).toBeNull();expect(validLocation({...location,longitude:NaN})).toBeNull();expect(validLocation({...location,postcode:''})).toBeNull();expect(validLocation({...location,source:'unknown'})).toBeNull();});
 it('keeps a guest location in persistent browser storage and notifies other functions',async()=>{const changed=vi.fn();window.addEventListener('showhome-location-changed',changed);expect(await saveLocation(location)).toContain('Saved for 24 hours');expect(JSON.parse(localStorage.getItem('showhome-location-v1')!).location).toEqual(location);expect(changed).toHaveBeenCalledOnce();expect(auth.updateUser).not.toHaveBeenCalled();});
 it('saves location metadata for signed-in users',async()=>{auth.getSession.mockResolvedValue({data:{session:{user:{id:'test'}}},error:null});await saveLocation(location);expect(auth.updateUser).toHaveBeenCalledWith({data:{showhome_location:location}});expect(localStorage.getItem('showhome-location-v1')).toBeNull();});
 it('reports a profile save failure without treating it as saved',async()=>{auth.getSession.mockResolvedValue({data:{session:{user:{id:'test'}}},error:null});auth.updateUser.mockResolvedValue({error:new Error('offline')});await expect(saveLocation(location)).rejects.toThrow('profile could not be updated');expect(localStorage.getItem('showhome-location-v1')).toBeNull();});
 it('removes the location in both browser and profile',async()=>{auth.getSession.mockResolvedValue({data:{session:{user:{id:'test'}}},error:null});await saveLocation(location);await saveLocation(null);expect(localStorage.getItem('showhome-location-v1')).toBeNull();expect(auth.updateUser).toHaveBeenLastCalledWith({data:{showhome_location:null}});});
 it('expires guest preferences after 24 hours and discards old permanent records',async()=>{await saveLocation(location);const record=JSON.parse(localStorage.getItem('showhome-location-v1')!);expect(record.expiresAt-Date.now()).toBeLessThanOrEqual(guestLocationLifetime);expect(readGuestLocation()).toEqual(location);localStorage.setItem('showhome-location-v1',JSON.stringify({...record,expiresAt:Date.now()-1}));expect(readGuestLocation()).toBeNull();expect(localStorage.getItem('showhome-location-v1')).toBeNull();localStorage.setItem('showhome-location-v1',JSON.stringify(location));expect(readGuestLocation()).toBeNull();});
});
