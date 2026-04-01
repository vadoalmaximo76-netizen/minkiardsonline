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

function getSeenKey(userId: number | undefined, tooltipId: number): string {
  return `${userId ?? 'guest'}_${tooltipId}`;
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markSeen(key: string): void {
  const seen = loadSeen();
  seen.add(key);
  localStorage.setItem(VISITED_KEY, JSON.stringify([...seen]));
}

const SIZE_CLASS: Record<string, string> = {
  small: 'max-w-xs',
  medium: 'max-w-sm',
  large: 'max-w-md',
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
    markSeen(key);
    setTimeout(onDismiss, 300);
  }, [onDismiss, userId, tooltip.id]);

  const isSlide = tooltip.isSlide && Array.isArray(tooltip.slides) && tooltip.slides.length > 0;
  const slides: SlideData[] = isSlide ? tooltip.slides : [{ title: tooltip.title, body: tooltip.body, imageUrl: tooltip.imageUrl || undefined }];
  const current = slides[slideIdx] || slides[0];
  const imgPos = tooltip.imagePosition || 'top';
  const sizeClass = SIZE_CLASS[tooltip.size] || SIZE_CLASS.medium;

  const imgEl = (src: string) => (
    <img src={src} alt="" className="w-full rounded-xl object-cover max-h-36" />
  );

  const contentEl = (
    <div className={imgPos === 'left' || imgPos === 'right' ? 'flex-1 min-w-0' : ''}>
      <h4 className="font-bold text-base leading-tight mb-1">{current.title || tooltip.title}</h4>
      <p className="text-sm leading-relaxed opacity-90">{current.body || tooltip.body}</p>
    </div>
  );

  const hasImage = !!(current.imageUrl);

  const renderBody = () => {
    if (!hasImage) return contentEl;
    if (imgPos === 'top') return <><div className="mb-3">{imgEl(current.imageUrl!)}</div>{contentEl}</>;
    if (imgPos === 'bottom') return <>{contentEl}<div className="mt-3">{imgEl(current.imageUrl!)}</div></>;
    if (imgPos === 'left') return <div className="flex gap-3 items-start"><div className="w-20 flex-shrink-0">{imgEl(current.imageUrl!)}</div>{contentEl}</div>;
    if (imgPos === 'right') return <div className="flex gap-3 items-start">{contentEl}<div className="w-20 flex-shrink-0">{imgEl(current.imageUrl!)}</div></div>;
    return contentEl;
  };

  return (
    <div
      className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[95] w-[92vw] ${sizeClass} transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div
        className="rounded-2xl shadow-2xl p-4 relative"
        style={{ backgroundColor: tooltip.bgColor, color: tooltip.textColor }}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: tooltip.textColor }}
        >
          <X size={16} />
        </button>

        <div className="pr-6">
          {renderBody()}
        </div>

        {isSlide && slides.length > 1 && (
          <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${tooltip.textColor}25` }}>
            <button
              onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
              disabled={slideIdx === 0}
              className="p-1 rounded-lg transition-opacity disabled:opacity-30"
              style={{ color: tooltip.textColor }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs opacity-60" style={{ color: tooltip.textColor }}>
              {slideIdx + 1} / {slides.length}
            </span>
            <button
              onClick={() => {
                if (slideIdx < slides.length - 1) {
                  setSlideIdx(i => i + 1);
                } else {
                  dismiss();
                }
              }}
              className="p-1 rounded-lg transition-opacity"
              style={{ color: tooltip.textColor }}
            >
              {slideIdx < slides.length - 1 ? <ChevronRight size={18} /> : <span className="text-xs font-semibold">OK</span>}
            </button>
          </div>
        )}

        {!isSlide && (
          <div className="flex justify-end mt-3 pt-2" style={{ borderTop: `1px solid ${tooltip.textColor}25` }}>
            <button
              onClick={dismiss}
              className="text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
              style={{ color: tooltip.textColor }}
            >
              Ho capito →
            </button>
          </div>
        )}
      </div>
    </div>
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
          const visible = data.tooltips.filter((t: PageTooltip) => {
            if (!t.isActive) return false;
            if (t.showMode === 'first_visit') {
              const key = getSeenKey(userId, t.id);
              return !seen.has(key);
            }
            return true;
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
