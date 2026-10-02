import { developers, readCollection } from '../../../../web/collections';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 if (!developers.some(d => d.slug === slug)) return Response.json({ error: 'Unknown developer' }, { status: 404 });
 return Response.json(await readCollection(slug), { headers: { 'Cache-Control': 'no-store' } });
}
