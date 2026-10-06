export function isNonRoom(roomType?: string, description?: string, reason?: string): boolean {
 const r = (roomType || '').toLowerCase().replace(/_/g, ' ').trim();
 const d = (description || '').toLowerCase();
 const re = (reason || '').toLowerCase();
 const text = `${r} ${d} ${re}`;

 if (/\b(infographic|floor[ -]?plan|document|energy assessment|energy performance|energy rating|site plan|map graphic|marketing image|promotional graphic|predicted energy assessment|epc chart|epc document|certificate document|rating chart)\b/i.test(text)) {
  return true;
 }
 if (/\b(illustration|map|site plan|site_plan|infographic|document|energy_assessment|energy rating chart|text)\b/i.test(r)) {
  return true;
 }
 if (/\bnot a room\b/i.test(re) && !/\b(exterior|garden|patio|facade|balcony|street|front of the house|rear garden)\b/i.test(text)) {
  return true;
 }
 return false;
}

export function isRoomImage(image: { verdict?: { roomType?: string; description?: string; reason?: string }; categorisation?: { isRoom?: boolean } }): boolean {
 if (image.categorisation?.isRoom !== undefined) return image.categorisation.isRoom;
 return !isNonRoom(image.verdict?.roomType, image.verdict?.description, image.verdict?.reason);
}
