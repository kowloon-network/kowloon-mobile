// Aspect ratio (width/height — RN's `aspectRatio` convention) to display a feed
// image at. Floored at 3:4 so a tall portrait is capped at height = width × 4/3
// and cropped (use resizeMode="cover"); landscape and mild portraits show whole.
// Falls back to 4/5 when the attachment carries no dimensions (legacy uploads
// pre-dating stored width/height, or external/proxied images).
export function imageDisplayRatio(att) {
  const w = Number(att?.width) || 0;
  const h = Number(att?.height) || 0;
  if (!w || !h) return 4 / 5;
  return Math.max(w / h, 3 / 4);
}
