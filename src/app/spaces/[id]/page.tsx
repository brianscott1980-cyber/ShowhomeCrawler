import {permanentRedirect} from 'next/navigation';
type Props={params:Promise<{id:string}>};
export default async function Page({params}:Props){permanentRedirect(`/interiors/${(await params).id}`);}
