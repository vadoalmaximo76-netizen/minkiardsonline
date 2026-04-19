import { useRef, useCallback, useState } from 'react';
import type { VictoryCardStats } from '../components/VictoryCard';

export function useShareVictory() {
  const [isGenerating, setIsGenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const shareVictory = useCallback(async (stats: VictoryCardStats) => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      const html2canvas = (await import('html2canvas')).default;

      if (!containerRef.current) {
        setIsGenerating(false);
        return;
      }

      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const filename = `minkiards-vittoria-${stats.winnerName.replace(/\s+/g, '-').toLowerCase()}.png`;

      if (navigator.canShare) {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            downloadDataUrl(dataUrl, filename);
            setIsGenerating(false);
            return;
          }
          const file = new File([blob], filename, { type: 'image/png' });
          const shareData: ShareData = {
            title: 'MINKIARDS – Ho vinto! 🏆',
            text: `${stats.winnerName} ha vinto una partita di MINKIARDS con +${stats.pointsEarned} PR!`,
            files: [file],
          };
          if (navigator.canShare(shareData)) {
            try {
              await navigator.share(shareData);
            } catch (err) {
              const errName = err instanceof Error ? err.name : '';
              if (errName !== 'AbortError') {
                downloadDataUrl(dataUrl, filename);
              }
            }
          } else {
            downloadDataUrl(dataUrl, filename);
          }
          setIsGenerating(false);
        }, 'image/png');
      } else {
        downloadDataUrl(dataUrl, filename);
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('[useShareVictory] error generating card:', err);
      setIsGenerating(false);
    }
  }, [isGenerating]);

  return { containerRef, shareVictory, isGenerating };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
