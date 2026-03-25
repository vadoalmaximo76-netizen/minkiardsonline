const _registry = new Map<string, HTMLElement>();

export const cardRegistry = {
  set(id: string, el: HTMLElement | null) {
    if (el) _registry.set(id, el);
    else _registry.delete(id);
  },
  getRect(id: string): DOMRect | null {
    const el = _registry.get(id);
    if (!el) return null;
    return el.getBoundingClientRect();
  },
  getElement(id: string): HTMLElement | null {
    return _registry.get(id) ?? null;
  },
  getImageSrc(id: string): string | null {
    const el = _registry.get(id);
    if (!el) return null;
    const img = el.querySelector('img');
    return img?.src ?? null;
  },
};
