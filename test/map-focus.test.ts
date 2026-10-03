import {expect,it} from 'vitest';
import {focusPadding} from '../src/web/map-focus';
import {homeTypeName} from '../src/reports/home-display';
it('recovers the actual house name from image-only titles',()=>{expect(homeTypeName('<img src="https://example.com/house.jpg" alt="Cranleigh">')).toBe('Cranleigh');expect(homeTypeName('&lt;img src=&quot;x&quot; alt=&quot;Winster&quot;&gt;')).toBe('Winster');expect(homeTypeName('Plot 12 – <b>The Oak</b>')).toBe('The Oak');});

it('uses camera padding to preserve the focus centre across viewport changes',()=>{expect(focusPadding({left:460,top:160,right:1180,bottom:760},{clientWidth:1200,clientHeight:800})).toEqual({left:460,top:160,right:20,bottom:40});});
