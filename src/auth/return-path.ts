export function safeReturnPath(value: string | null): string {
 if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x1f]/.test(value)) return '/';
 const url = new URL(value, 'https://showhome.invalid');
 if (url.origin !== 'https://showhome.invalid' || url.pathname.startsWith('/auth/')) return '/';
 return url.pathname + url.search + url.hash;
}
