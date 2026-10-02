import {GroupDetail,groupMetadata} from '../../../web/group-pages';
export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props){return groupMetadata('buildings',(await params).id);}
export default async function Page({params}:Props){return <GroupDetail kind="buildings" id={(await params).id}/>;}
