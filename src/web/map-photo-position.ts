type Dot = { x: number; y: number; related: boolean };

// Score actual screen coordinates so SVG letterboxing and mobile sizing are accounted for.
export function choosePhotoPosition(width: number, height: number, frameWidth: number, frameHeight: number, dots: Dot[]) {
 const inset = 12;
 const maxLeft = Math.max(0, width - frameWidth - inset);
 const maxTop = Math.max(0, height - frameHeight - inset);
 const minLeft = Math.min(inset, maxLeft);
 const minTop = Math.min(inset, maxTop);
 const visibleDots = dots.filter(dot => dot.x >= 0 && dot.x <= width && dot.y >= 0 && dot.y <= height);
 let best = { left: minLeft, top: minTop };
 let bestScore = [Infinity, Infinity, Infinity];
 for (let row = 0; row <= 20; row++) for (let column = 0; column <= 20; column++) {
  const left = minLeft + (maxLeft - minLeft) * column / 20;
  const top = minTop + (maxTop - minTop) * row / 20;
  let relatedCovered = 0;
  let covered = 0;
  let distance = 0;
  for (const dot of visibleDots) {
   const dx = Math.max(left - dot.x, 0, dot.x - left - frameWidth);
   const dy = Math.max(top - dot.y, 0, dot.y - top - frameHeight);
   if (dx < 14 && dy < 14) { covered++; if (dot.related) relatedCovered++; }
   if (dot.related) distance += Math.hypot(dx, dy);
  }
  // Prioritize keeping related dots clear, then other dots, then proximity to related sites.
  const score = [relatedCovered, covered, distance];
  const better = score[0]! < bestScore[0]! || (score[0] === bestScore[0] && (score[1]! < bestScore[1]! || (score[1] === bestScore[1] && score[2]! < bestScore[2]!)));
  if (better) { best = { left, top }; bestScore = score; }
 }
 return best;
}
