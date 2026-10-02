import {GroupDetail,groupMetadata} from '../../../web/group-pages';
import type {SearchValues} from '../../../web/url-query';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string[]}>;searchParams:Promise<SearchValues>};
export async function generateMetadata({params}:Props){return groupMetadata('interiors',(await params).slug.join('/'));}
export default async function Page({params,searchParams}:Props){return <GroupDetail kind="interiors" id={(await params).slug.join('/')} searchParams={await searchParams}/>;}
