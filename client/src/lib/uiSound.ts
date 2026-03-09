let ctx: AudioContext | null = null;
let initialized = false;

function getCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function synth(
  freq: number,
  endFreq: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine'
) {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  const env = ac.createGain();

  osc.connect(env);
  env.connect(ac.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + duration);

  env.gain.setValueAtTime(0, ac.currentTime);
  env.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration + 0.01);
}

export function playClick() {
  synth(520, 360, 0.055, 0.18, 'sine');
}

export function playOpen() {
  synth(680, 300, 0.13, 0.14, 'sine');
  setTimeout(() => synth(900, 500, 0.08, 0.07, 'sine'), 20);
}

export function playBack() {
  synth(380, 260, 0.07, 0.13, 'sine');
}

export function playSuccess() {
  synth(600, 900, 0.1, 0.15, 'sine');
  setTimeout(() => synth(900, 1200, 0.12, 0.1, 'sine'), 80);
}

const INTERACTIVE_SELECTORS = [
  'button',
  '[role="button"]',
  'a[href]',
  '[tabindex]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'select',
  '.cursor-pointer',
];

function isInteractive(el: Element): boolean {
  return INTERACTIVE_SELECTORS.some(sel => el.closest(sel) !== null);
}

export function initGlobalClickSound() {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (!target) return;
    if (isInteractive(target)) playClick();
  }, { capture: true, passive: true });
}

export function playUISound(sound: 'click' | 'open' | 'back' | 'success' | string) {
  if (sound === 'open') playOpen();
  else if (sound === 'back') playBack();
  else if (sound === 'success') playSuccess();
  else playClick();
}
