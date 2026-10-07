import {searchListing} from '../../web/seo';
import {GroupDirectory} from '../../web/group-pages';
export const metadata=searchListing('New Build Developments & Showhome Interiors','Explore UK new build developments, find homes near you and compare building types and showhome interiors. Discover ideas and save your favourites.','/developments');
export default function Page(){return <GroupDirectory kind="locations"/>;}
