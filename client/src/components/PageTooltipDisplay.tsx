import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideData {
  title: string;
  body: string;
  imageUrl?: string;
}

interface PageTooltip {
  id: number;
  pageRoute: string;
  title: string;
  body: string;
  bgColor: string;
  textColor: string;
  size: 'small' | 'medium' | 'large';
  imageUrl?: string | null;
  imagePosition?: string;
  isSlide: boolean;
  slides: SlideData[];
  showMode: 'always' | 'first_visit';
  isActive: boolean;
  priority: number;
}

interface PageTooltipDisplayProps {
  currentRoute: string;
  userId?: number;
}

const VISITED_KEY = 'minkiards_page_tooltips_seen';
const SESSION_VISITED_KEY = 'minkiards_page_tooltips_seen_session';

function getSeenKey(userId: number | undefined, tooltipId: number): string {
  return `${userId ?? 'guest'}_${tooltipId}`;
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function loadSessionSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_VISITED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markSeen(key: string, mode: 'always' | 'first_visit'): void {
  if (mode === 'first_visit') {
    const seen = loadSeen();
    seen.add(key);
    localStorage.setItem(VISITED_KEY, JSON.stringify([...seen]));
  } else {
    const seen = loadSessionSeen();
    seen.add(key);
    sessionStorage.setItem(SESSION_VISITED_KEY, JSON.stringify([...seen]));
  }
}

const SIZE_CLASS: Record<string, string> = {
  small: 'max-w-lg',
  medium: 'max-w-2xl',
  large: 'max-w-4xl',
};

function TooltipCard({
  tooltip,
  userId,
  onDismiss,
}: {
  tooltip: PageTooltip;
  userId?: number;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    const key = getSeenKey(userId, tooltip.id);
    markSeen(key, tooltip.showMode);
    setTimeout(onDismiss, 350);
  }, [onDismiss, userId, tooltip.id, tooltip.showMode]);

  const isSlide = tooltip.isSlide && Array.isArray(tooltip.slides) && tooltip.slides.length > 0;
  const slides: SlideData[] = isSlide
    ? tooltip.slides
    : [{ title: tooltip.title, body: tooltip.body, imageUrl: tooltip.imageUrl || undefined }];
  const current = slides[slideIdx] || slides[0];
  const imgPos = tooltip.imagePosition || 'top';
  const sizeClass = SIZE_CLASS[tooltip.size] || SIZE_CLASS.medium;

  const imgEl = (src: string) => (
    <img src={src} alt="" className="w-full rounded-2xl object-cover max-h-64" />
  );

  const contentEl = (
    <div className={imgPos === 'left' || imgPos === 'right' ? 'flex-1 min-w-0' : ''}>
      {(current.title || tooltip.title) && (
        <h4 className="font-extrabold text-2xl leading-tight mb-3">{current.title || tooltip.title}</h4>
      )}
      <p className="text-base leading-relaxed opacity-90">{current.body || tooltip.body}</p>
    </div>
  );

  const hasImage = !!(current.imageUrl);

  const renderBody = () => {
    if (!hasImage) return contentEl;
    if (imgPos === 'top') return <><div className="mb-4">{imgEl(current.imageUrl!)}</div>{contentEl}</>;
    if (imgPos === 'bottom') return <>{contentEl}<div className="mt-4">{imgEl(current.imageUrl!)}</div></>;
    if (imgPos === 'left') return <div className="flex gap-4 items-start"><div className="w-32 flex-shrink-0">{imgEl(current.imageUrl!)}</div>{contentEl}</div>;
    if (imgPos === 'right') return <div className="flex gap-4 items-start">{contentEl}<div className="w-32 flex-shrink-0">{imgEl(current.imageUrl!)}</div></div>;
    return contentEl;
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[200] transition-all duration-350 ${visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none pointer-events-none'}`}
        onClick={dismiss}
      />

      <div
        className={`fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none`}
      >
        <div
          className={`w-full ${sizeClass} pointer-events-auto transition-all duration-350 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-6'}`}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-8 relative"
            style={{ backgroundColor: tooltip.bgColor, color: tooltip.textColor }}
          >
            <button
              onClick={dismiss}
              className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full transition-all hover:scale-110"
              style={{ backgroundColor: `${tooltip.textColor}20`, color: tooltip.textColor }}
            >
              <X size={18} />
            </button>

            <div className="pr-8">
              {renderBody()}
            </div>

            {isSlide && slides.length > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: `1px solid ${tooltip.textColor}25` }}>
                <button
                  onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
                  disabled={slideIdx === 0}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-30 hover:opacity-80"
                  style={{ backgroundColor: `${tooltip.textColor}15`, color: tooltip.textColor }}
                >
                  <ChevronLeft size={18} /> Indietro
                </button>
                <div className="flex items-center gap-1.5">
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ backgroundColor: i === slideIdx ? tooltip.textColor : `${tooltip.textColor}40` }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (slideIdx < slides.length - 1) {
                      setSlideIdx(i => i + 1);
                    } else {
                      dismiss();
                    }
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl font-semibold text-sm transition-all hover:opacity-80"
                  style={{ backgroundColor: `${tooltip.textColor}15`, color: tooltip.textColor }}
                >
                  {slideIdx < slides.length - 1 ? <>Avanti <ChevronRight size={18} /></> : 'Ho capito ✓'}
                </button>
              </div>
            )}

            {!isSlide && (
              <div className="flex justify-center mt-6 pt-4" style={{ borderTop: `1px solid ${tooltip.textColor}25` }}>
                <button
                  onClick={dismiss}
                  className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80 hover:scale-105"
                  style={{ backgroundColor: `${tooltip.textColor}20`, color: tooltip.textColor }}
                >
                  Ho capito ✓
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const PageTooltipDisplay: React.FC<PageTooltipDisplayProps> = ({ currentRoute, userId }) => {
  const [tooltips, setTooltips] = useState<PageTooltip[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!currentRoute) return;
    let cancelled = false;
    fetch(`/api/page-tooltips?route=${encodeURIComponent(currentRoute)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.tooltips)) {
          const seen = loadSeen();
          const sessionSeen = loadSessionSeen();
          const visible = data.tooltips.filter((t: PageTooltip) => {
            if (!t.isActive) return false;
            const key = getSeenKey(userId, t.id);
            if (t.showMode === 'first_visit') {
              return !seen.has(key);
            }
            // 'always' — show once per session (resets on page reload)
            return !sessionSeen.has(key);
          });
          setTooltips(visible);
          setDismissed(new Set());
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentRoute, userId]);

  const handleDismiss = useCallback((id: number) => {
    setDismissed(d => new Set([...d, id]));
  }, []);

  const active = tooltips.filter(t => !dismissed.has(t.id));

  if (active.length === 0) return null;

  const first = active[0];

  return (
    <TooltipCard
      key={first.id}
      tooltip={first}
      userId={userId}
      onDismiss={() => handleDismiss(first.id)}
    />
  );
};
