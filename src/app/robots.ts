import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../web/seo';
export default function robots():MetadataRoute.Robots{
 return {rules:{userAgent:'*',allow:'/',disallow:['/api/jobs','/api/location','/api/collections/']},sitemap:absoluteUrl('/sitemap.xml')};
}
