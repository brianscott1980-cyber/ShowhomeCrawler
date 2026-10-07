import {searchListing} from '../../web/seo';
import {GroupDirectory} from '../../web/group-pages';
export const metadata=searchListing('Showhome Interiors & Room Inspiration','Explore real UK showhome interiors by room. Compare kitchens, bedrooms and living spaces, discover colours and furnishings, and save your favourite ideas.','/interiors');
export default function Page(){return <GroupDirectory kind="interiors"/>;}
