import {Profile} from '../../web/profile';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import * as Home from '../../page-views/page';
import * as Builders from '../../page-views/homebuilders/page';
import * as Favourites from '../../page-views/favourites/page';
import * as Buildings from '../../page-views/buildings/page';
import * as Interiors from '../../page-views/interiors/page';
import * as Locations from '../../page-views/locations/page';
import * as Developer from '../../page-views/developers/[slug]/page';
import { GroupDetail, groupMetadata } from '../../web/group-pages';
import { withFilters, type SearchValues } from '../../web/url-query';

// Keep public page URLs in one function to stay within Vercel Hobby limits.
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<SearchValues> };
const directories = { buildings: Buildings, interiors: Interiors, locations: Locations };
function directory(value: string) {
 return value === 'buildings' || value === 'interiors' || value === 'locations' ? value : null;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const path = (await params).path ?? [];
 if (!path.length) return Home.metadata;
 if (path.length === 1) {
  if (path[0] === 'profile') return {title:'Your profile | Showhome Explorer',robots:{index:false,follow:false}};
  if (path[0] === 'homebuilders') return Builders.metadata;
  if (path[0] === 'favourites') return Favourites.metadata;
  const kind = directory(path[0]!);
  if (kind) return directories[kind].metadata;
 }
 if (path[0] === 'developers' && path.length === 2) return Developer.generateMetadata({ params: Promise.resolve({ slug: path[1]! }) });
 const kind = directory(path[0]!);
 if (kind && path.length > 1) return groupMetadata(kind, path.slice(1).join('/'));
 return {};
}
export default async function Page({ params, searchParams }: Props) {
 const path = (await params).path ?? [];
 if (!path.length) return <Home.default/>;
 if (path.length === 1) {
  if (path[0] === 'profile') return <Profile/>;
  if (path[0] === 'homebuilders') return <Builders.default/>;
  if (path[0] === 'favourites') return <Favourites.default/>;
  const kind = directory(path[0]!);
  if (kind) { const View = directories[kind].default; return <View/>; }
 }
 if (path[0] === 'developers' && path.length === 2) return <Developer.default params={Promise.resolve({ slug: path[1]! })}/>;
 const kind = directory(path[0]!);
 if (kind && path.length > 1) return <GroupDetail kind={kind} id={path.slice(1).join('/')} searchParams={await searchParams}/>;
 if (path[0] === 'sites' || path[0] === 'spaces') {
  const target = path[0] === 'sites' ? 'locations' : 'interiors';
  if (path.length === 1) permanentRedirect(`/${target}`);
  if (path.length === 2) permanentRedirect(withFilters(`/${target}/${path[1]}`, await searchParams));
 }
 notFound();
}
