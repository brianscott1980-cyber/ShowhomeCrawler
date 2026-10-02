import { jobInput, readJob, startJob } from '../../../web/jobs';
export const runtime = 'nodejs';
export async function GET() { return Response.json(await readJob(), { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
 const url = new URL(request.url);
 // Processing controls are for the local operator and reject cross-site writes.
 if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || request.headers.get('origin') !== url.origin) return Response.json({ error: 'Processing is available from this app on localhost.' }, { status: 403 });
 let input;
 try { input = jobInput.parse(await request.json()); } catch { return Response.json({ error: 'Invalid processing options.' }, { status: 400 }); }
 try { return Response.json(await startJob(input), { status: 202 }); }
 catch (error) { return Response.json({ error: error instanceof Error && error.message === 'A processing job is already running.' ? error.message : 'Could not start processing.' }, { status: 409 }); }
}
