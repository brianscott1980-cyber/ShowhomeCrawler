export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const postcode=params.get('postcode')?.trim().toUpperCase();
 const latitude=Number(params.get('latitude')),longitude=Number(params.get('longitude'));
 const reverse=!postcode;
 if(reverse?(!params.has('latitude')||!params.has('longitude')||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180):!/^(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/.test(postcode!))return Response.json({error:reverse?'Location is invalid.':'Enter a valid UK postcode.'},{status:400});
 try{
  const url=reverse?`https://api.postcodes.io/postcodes?lat=${latitude}&lon=${longitude}&limit=1&radius=10000`:'https://api.postcodes.io/postcodes/'+encodeURIComponent(postcode!);
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),cache:'no-store'});const data=await response.json();
  if(response.status===404)return Response.json({error:'Postcode not found. Check it and try again.'},{status:404});
  const result=reverse?data.result?.[0]:data.result;
  if(reverse&&response.ok&&!result)return Response.json({area:null},{headers:{'Cache-Control':'no-store'}});
  if(!response.ok||!Number.isFinite(result?.latitude)||!Number.isFinite(result?.longitude))throw new Error();
  const parish=typeof result.parish==='string'&&!/unparished|not applicable/i.test(result.parish)?result.parish:null;
  const area=result.bua||parish||result.admin_ward||result.admin_district||result.admin_county||result.region||result.country||null;
  return Response.json(reverse?{area}:{postcode:result.postcode,latitude:result.latitude,longitude:result.longitude,area},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Location lookup is unavailable. Please try again.'},{status:502});}
}
