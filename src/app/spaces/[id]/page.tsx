import {GroupDetail,groupMetadata} from '../../../web/group-pages';
export const dynamic='force-dynamic';
type Props={params:Promise<{id:string}>};
export async function generateMetadata({params}:Props){return groupMetadata('spaces',(await params).id);}
export default async function Page({params}:Props){return <GroupDetail kind="spaces" id={(await params).id}/>;}
