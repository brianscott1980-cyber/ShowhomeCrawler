import {Classifications} from '../../web/classifications';
export const metadata={title:'Classifications',robots:{index:false,follow:false}};
export default function Page(){return <Classifications localAccess={process.env.NODE_ENV==='development'&&!process.env.VERCEL}/>;}
