import {permanentRedirect} from 'next/navigation';
import {withFilters,type SearchValues} from '../../../web/url-query';
type Props={params:Promise<{id:string}>;searchParams:Promise<SearchValues>};
export default async function Page({params,searchParams}:Props){permanentRedirect(withFilters(`/locations/${(await params).id}`,await searchParams));}
