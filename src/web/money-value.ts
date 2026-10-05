/** Accept pounds with optional currency sign, correctly grouped commas and pence. */
export function parseMoney(text:string):string|null{
 const value=text.trim();if(!value)return '';
 if(!/^£?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))return null;
 const amount=Number(value.replace(/[£,\s]/g,''));
 return Number.isFinite(amount)&&amount>=0&&amount<=Number.MAX_SAFE_INTEGER?String(amount):null;
}
