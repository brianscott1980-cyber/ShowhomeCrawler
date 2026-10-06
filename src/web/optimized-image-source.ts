/** Internal image optimization needs bytes, rather than the asset route's source redirect. */
export function optimizedImageSource(src:string){return src.startsWith('/api/assets/')?`${src}${src.includes('?')?'&':'?'}optimize=1`:src;}
