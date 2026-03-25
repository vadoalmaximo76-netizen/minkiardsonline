const _registry = new Map<string, HTMLElement>();

let _pendingMosse: { rect: DOMRect; imageSrc: string | null } | null = null;

function findCardElement(id: string): HTMLElement | null {
  // 1. Try direct registry (fastest)
  const el = _registry.get(id);
  if (el) return el;
  // 2. Fall back to DOM attribute query (handles timing gaps)
  return document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
}

export const cardRegistry = {
  set(id: string, el: HTMLElement | null) {
    if (el) _registry.set(id, el);
    else _registry.delete(id);
  },
  getRect(id: string): DOMRect | null {
    const el = findCardElement(id);
    if (!el) return null;
    return el.getBoundingClientRect();
  },
  getElement(id: string): HTMLElement | null {
    return findCardElement(id);
  },
  getImageSrc(id: string): string | null {
    const el = findCardElement(id);
    if (!el) return null;
    const img = el.querySelector('img');
    return img?.src ?? null;
  },
  storePendingMosse(id: string) {
    const el = findCardElement(id);
    console.log(`[MossaFlyer] storePendingMosse(${id}): registry=${_registry.has(id)}, domQuery=${!!document.querySelector(`[data-card-id="${id}"]`)}, found=${!!el}`);
    if (!el) {
      // Last resort: use a sensible default for the player's side (bottom-center of viewport)
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const fallbackRect = new DOMRect(vw / 2 - 30, vh * 0.75, 60, 84);
      const imgEls = document.querySelectorAll<HTMLImageElement>('[data-card-id] img');
      let imageSrc: string | null = null;
      // Try to find the mosse card image from any recently visible card
      _pendingMosse = { rect: fallbackRect, imageSrc };
      console.log(`[MossaFlyer] storePendingMosse FALLBACK used: ${JSON.stringify({x:fallbackRect.x,y:fallbackRect.y})}`);
      return;
    }
    const rect = el.getBoundingClientRect();
    const img = el.querySelector('img');
    _pendingMosse = { rect, imageSrc: img?.src ?? null };
    console.log(`[MossaFlyer] storePendingMosse OK: rect=${JSON.stringify({x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),h:Math.round(rect.height)})}`);
  },
  consumePendingMosse(): { rect: DOMRect; imageSrc: string | null } | null {
    const val = _pendingMosse;
    _pendingMosse = null;
    console.log(`[MossaFlyer] consumePendingMosse: ${val ? `HAS pending rect=(${Math.round(val.rect.x)},${Math.round(val.rect.y)})` : 'NULL'}`);
    return val;
  },
};
