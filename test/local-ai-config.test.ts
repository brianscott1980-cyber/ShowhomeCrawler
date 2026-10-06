import {expect,it} from 'vitest';
import {parse} from 'dotenv';
import {envSetting} from '../src/cli/local-ai-config';
it('round-trips Windows drive and UNC paths without doubling backslashes',()=>{
 for(const path of [String.raw`\\Synology\GIT\ShowhomeCrawler-content`,String.raw`Z:\ShowhomeCrawler-content`,'/Volumes/GIT/ShowhomeCrawler-content'])expect(parse(envSetting('LOCAL_CONTENT_ROOT',path)).LOCAL_CONTENT_ROOT).toBe(path);
 expect(()=>envSetting('LOCAL_CONTENT_ROOT','path\nDATABASE_URL=bad')).toThrow();
});
