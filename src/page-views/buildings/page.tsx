import {searchListing} from '../../web/seo';
import {GroupDirectory} from '../../web/group-pages';
export const metadata=searchListing('House Types, Floorplans & Showhome Interiors','Compare house types from UK builders. Explore exterior photographs, available floorplans and showhome interiors to find layouts and ideas you love.','/buildings');
export default function Page(){return <GroupDirectory kind="buildings"/>;}
