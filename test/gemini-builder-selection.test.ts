import {expect,it} from 'vitest';
import {geminiBuilderSelection} from '../src/vision/gemini-builder-selection';
it('selects the smallest unfinished queue first and excludes the live Ollama builder',()=>{
 const queues=[{slug:'large',remaining:800,ollamaActive:false},{slug:'small',remaining:5,ollamaActive:false},{slug:'ollama',remaining:1,ollamaActive:true},{slug:'done',remaining:0,ollamaActive:false}];
 expect(geminiBuilderSelection(queues).map(q=>q.slug)).toEqual(['small','large']);
});
it('leaves the final unfinished builder to Ollama even when Ollama has not started it yet',()=>{
 expect(geminiBuilderSelection([{slug:'last',remaining:20,ollamaActive:false},{slug:'done',remaining:0,ollamaActive:false}])).toEqual([]);
});
it('allows Gemini to work when the other pending builder belongs to Ollama',()=>{
 expect(geminiBuilderSelection([{slug:'last-gemini',remaining:20,ollamaActive:false},{slug:'ollama',remaining:100,ollamaActive:true}]).map(q=>q.slug)).toEqual(['last-gemini']);
});
