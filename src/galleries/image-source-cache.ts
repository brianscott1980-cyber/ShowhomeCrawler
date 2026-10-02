// Scope filenames to their host and directory. Only discard known presentation
// parameters: unknown query parameters may select a different source image.
export function imageSourceKey(source: string): string {
 const url = new URL(source);
 url.hash = '';
 for (const key of ['width', 'height', 'quality', 'format', 'w', 'h', 'q', 'fm', 'rmode']) url.searchParams.delete(key);
 url.searchParams.sort();
 return url.href;
}

export class ImageSourceCache<T> {
 private tasks = new Map<string, Promise<T | null>>();

 get(source: string, process: () => Promise<T | null>, onReuse: () => void): Promise<T | null> {
  const key = imageSourceKey(source);
  const known = this.tasks.get(key);
  if (known) { onReuse(); return known; }
  // Register before processing starts so concurrent duplicates share the work.
  const task = Promise.resolve().then(process);
  this.tasks.set(key, task);
  void task.then(result => {
   if (result === null) this.tasks.delete(key);
  }, () => { this.tasks.delete(key); });
  return task;
 }
}
