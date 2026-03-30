const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[data-gamepad-focusable]',
].join(', ');

const GAMEPAD_FOCUS_CLASS = 'gamepad-focus';

let currentFocused: HTMLElement | null = null;

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
  if (rect.right < 0 || rect.left > window.innerWidth) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  return true;
}

function getCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

export function getGamepadFocused(): HTMLElement | null {
  return currentFocused;
}

export function setGamepadFocus(el: HTMLElement | null): void {
  if (currentFocused && currentFocused !== el) {
    currentFocused.classList.remove(GAMEPAD_FOCUS_CLASS);
  }
  currentFocused = el;
  if (el) {
    el.classList.add(GAMEPAD_FOCUS_CLASS);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

export function clearGamepadFocus(): void {
  if (currentFocused) {
    currentFocused.classList.remove(GAMEPAD_FOCUS_CLASS);
    currentFocused = null;
  }
}

export function initFromCursor(cx: number, cy: number): void {
  const elements = getFocusableElements();
  if (elements.length === 0) return;
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const el of elements) {
    const c = getCenter(el);
    const dist = Math.hypot(c.x - cx, c.y - cy);
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  if (best) setGamepadFocus(best);
}

export function dpadNavigate(direction: 'left' | 'right' | 'up' | 'down'): void {
  const elements = getFocusableElements();
  if (elements.length === 0) return;

  if (!currentFocused || !elements.includes(currentFocused)) {
    setGamepadFocus(elements[0]);
    return;
  }

  const from = getCenter(currentFocused);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of elements) {
    if (el === currentFocused) continue;
    const to = getCenter(el);
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    let inDirection = false;
    let primary = 0;
    let cross = 0;

    switch (direction) {
      case 'left':
        inDirection = dx < -4;
        primary = -dx;
        cross = Math.abs(dy);
        break;
      case 'right':
        inDirection = dx > 4;
        primary = dx;
        cross = Math.abs(dy);
        break;
      case 'up':
        inDirection = dy < -4;
        primary = -dy;
        cross = Math.abs(dx);
        break;
      case 'down':
        inDirection = dy > 4;
        primary = dy;
        cross = Math.abs(dx);
        break;
    }

    if (!inDirection) continue;

    const score = primary + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) setGamepadFocus(best);
}

export function clickFocused(): boolean {
  if (!currentFocused) return false;
  currentFocused.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return true;
}
