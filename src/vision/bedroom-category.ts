/** Bedroom size describes the bed, not the occupant or the size of the room. */
export function bedroomSubCategory(description='',roomType='',reason='',existing=''):string {
 const text=`${description} ${roomType} ${reason}`.toLowerCase();
 const double=/\b(double|(?:super[\s-]*)?king|queen|full)[\s-]*(?:size[d]?[\s-]*)?(bed|mattress)\b|\b(?:super[\s-]*)?king[\s-]+size\b|\bqueen[\s-]+size\b/;
 const single=/\b(single|twin|bunk)[\s-]*(?:size[d]?[\s-]*)?(beds?|mattress)\b|\bbunk beds?\b/;
 if(double.test(text))return 'Double bedroom';
 if(single.test(text))return 'Single bedroom';
 if(/\b(crib|cot|nursery)\b/.test(text))return 'Nursery';
 if(existing==='Double bedroom'||existing==='Single bedroom')return existing;
 return 'Bedroom (bed size unclear)';
}
