import {expect,it} from 'vitest';
import {parseMoney} from '../src/web/money-value';
it('accepts typed pounds and formats them as numeric filter values',()=>{
 expect(parseMoney('£350,000')).toBe('350000');expect(parseMoney('350000')).toBe('350000');expect(parseMoney(' £ 250,000.50 ')).toBe('250000.5');expect(parseMoney('')).toBe('');
});
it('rejects malformed grouping, negatives, extra pence and non-money text',()=>{
 for(const value of ['-1','35,00','250k','£','123.456','NaN','£1 £2'])expect(parseMoney(value)).toBeNull();
});
