'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AppJob } from '../models/app-job';

export function Processing({ developer }: { developer: string }) {
 const router = useRouter();
 const [job, setJob] = useState<AppJob | null>(null);
 const [error, setError] = useState('');
 const [sending, setSending] = useState(false);
 const lastStatus = useRef('');
 const [limits, setLimits] = useState({ maxDevelopments: 1000, maxProperties: 10000, maxImages: 20000 });
 const busy = sending || !!job && ['queued', 'discovering', 'classifying'].includes(job.status);
 useEffect(() => {
  let mounted = true;
  const poll = async () => { try { const response = await fetch('/api/jobs'); if (!response.ok) throw new Error(); const next = await response.json() as AppJob | null; if (mounted) { setJob(next); const status = `${next?.id}:${next?.status}`; if (next?.developer === developer && (['discovering', 'classifying'].includes(next.status) || status !== lastStatus.current)) router.refresh(); lastStatus.current = status; } } catch { if (mounted) setError('Unable to read processing status.'); } };
  void poll(); const timer = setInterval(poll, 5000); return () => { mounted = false; clearInterval(timer); };
 }, [developer, router]);
 async function start(action: 'crawl' | 'classify') {
  setSending(true); setError('');
  try { const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ developer, action, ...limits }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setJob(data); }
  catch (error) { setError(error instanceof Error ? error.message : 'Could not start processing.'); }
  finally { setSending(false); }
 }
 return <details className="processing"><summary>Process this developer <span>{busy ? '● Processing' : 'Crawl & analyse →'}</span></summary><p>Discover qualifying homes, reuse duplicate images, then analyse unique images in batches. Without a Gemini key, discovery completes with images ready for later analysis.</p><div className="limits">{([['maxDevelopments', 'Development limit', 1000], ['maxProperties', 'Property limit', 10000], ['maxImages', 'Image limit', 20000]] as const).map(([key, label, max]) => <label key={key}>{label}<input type="number" min={1} max={max} value={limits[key]} disabled={busy} onChange={e => setLimits({ ...limits, [key]: Number(e.target.value) })}/></label>)}</div><div className="actions"><button disabled={busy} onClick={() => start('crawl')}>Discover & analyse</button><button className="secondary" disabled={busy} onClick={() => start('classify')}>Resume pending analysis</button></div>{job && <p role="status">{job.developer === developer ? 'This developer' : job.developer}: {job.status.replaceAll('_', ' ')}{job.error ? ` — ${job.error}` : ''}</p>}{error && <p role="alert" className="error">{error}</p>}</details>;
}
