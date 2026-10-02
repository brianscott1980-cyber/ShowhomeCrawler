export const developers = [
 { slug: 'bellway', name: 'Bellway', website: 'https://www.bellway.co.uk', sitemap: '/developments-sitemap.xml' },
 { slug: 'cala', name: 'Cala', website: 'https://www.cala.co.uk', sitemap: '/sitemap.xml' },
 { slug: 'barratt', name: 'Barratt', website: 'https://www.barratthomes.co.uk', sitemap: '/sitemaps/sitemap-barratt-developments.xml' },
 { slug: 'taylor-wimpey', name: 'Taylor Wimpey', website: 'https://www.taylorwimpey.co.uk', sitemap: '/developments.xml' },
 { slug: 'david-wilson', name: 'David Wilson', website: 'https://www.dwh.co.uk', sitemap: '/sitemaps/sitemap-dwh-developments.xml' },
 { slug: 'miller-homes', name: 'Miller Homes', website: 'https://www.millerhomes.co.uk', sitemap: '/sitemaps.xml' },
 { slug: 'avant', name: 'Avant', website: 'https://www.avanthomes.co.uk', sitemap: '/sitemap.xml' },
 { slug: 'springfield', name: 'Springfield', website: 'https://www.springfield.co.uk', sitemap: '/sitemap.xml' },
 { slug: 'persimmon', name: 'Persimmon', website: 'https://www.persimmonhomes.com', sitemap: '/sitemap' },
 { slug: 'robertson-homes', name: 'Robertson Homes', website: 'https://www.robertsonhomes.co.uk', sitemap: '/sitemap_index.xml' },
 { slug: 'redrow', name: 'Redrow', website: 'https://www.redrow.co.uk', sitemap: '/sitemaps/sitemap-redrow-developments.xml' },
 { slug: 'berkeley-group', name: 'The Berkeley Group', website: 'https://www.berkeleygroup.co.uk', sitemap: '/sitemaps/sitemap-index' },
 { slug: 'crest-nicholson', name: 'Crest Nicholson', website: 'https://www.crestnicholson.com', sitemap: '/sitemap.xml' },
 { slug: 'lynch-homes', name: 'Lynch Homes', website: 'https://www.lynchhomes.co.uk', sitemap: '/sitemap.xml' },
 { slug: 'story-homes', name: 'Story Homes', website: 'https://www.storyhomes.co.uk', sitemap: '/sitemap_index.xml' },
 { slug: 'hill-group', name: 'Hill Group', website: 'https://www.hill.co.uk', sitemap: '/sitemap.xml' },
] as const;
export type DeveloperSlug = typeof developers[number]['slug'];
export const crawlOrder: DeveloperSlug[] = developers.slice(3).map(d => d.slug);
