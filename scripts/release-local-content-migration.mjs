import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.resolve(repository,'.showhome/storage-migration');
const progress=JSON.parse(await fs.readFile(path.join(directory,'progress.json'),'utf8'));
if(progress.status!=='completed'||progress.errors)throw new Error('Verified migration completion is required before release');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true}).trim();
git(repository,'fetch','origin');
const worktree=path.join(directory,'release-worktree-'+Date.now());
if(!path.resolve(worktree).startsWith(directory+path.sep))throw new Error('Invalid release worktree location');
git(repository,'worktree','add','--detach',worktree,'origin/main');
try{
 git(worktree,'merge','--no-edit','origin/release/1.0.0');
 const reportPath='docs/reports/local-content-migration.md';
 await fs.mkdir(path.join(worktree,'docs/reports'),{recursive:true});
 await fs.writeFile(path.join(worktree,reportPath),`# Local content migration\n\nCompleted: ${progress.completedAt}\n\nPrimary processing storage: D:\\ShowhomeCrawler\n\n| Outcome | Count |\n| --- | ---: |\n| Snapshot files scanned | ${progress.files} |\n| Image files hash verified | ${progress.images} |\n| New canonical image assets | ${progress.newAssets} |\n| Imported report snapshots | ${progress.reports} |\n| Additional classifications queued | ${progress.classifications} |\n| Retained classification or alias conflicts | ${progress.conflicts} |\n| Import errors | ${progress.errors} |\n\nDuplicate image bytes are shared through NTFS hard links. Current classifications retain priority. Variant originals and database dumps remain in backups/nas-import. Imported classification database presence is unverified until reconciliation. This migration does not upload images or modify Supabase.\n\nDetailed private logs and hashes remain in .showhome/storage-migration on D:. Normal processing no longer requires the NAS.\n`);
 git(worktree,'add','--',reportPath);
 git(worktree,'commit','-m','Record verified local content migration completion');
 const commit=git(worktree,'rev-parse','HEAD');
 git(worktree,'push','--atomic','origin','HEAD:main','HEAD:release/1.0.0');
 await fs.writeFile(path.join(directory,'release.json'),JSON.stringify({status:'released',commit,updatedAt:new Date().toISOString()}));
 if(!git(repository,'status','--porcelain','--untracked-files=no'))git(repository,'merge','--ff-only','origin/main');
}finally{git(repository,'worktree','remove','--force',worktree);}
