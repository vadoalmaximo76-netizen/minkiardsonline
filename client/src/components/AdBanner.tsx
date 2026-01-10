import React, { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AdBanner: React.FC<AdBannerProps> = ({ 
  format = 'auto', 
  responsive = true,
  className = '',
  style = {}
}) => {
  return (
    <div className={`ad-container ${className}`} style={style}>
      <p className="text-gray-500 text-xs text-center mb-1">Pubblicità</p>
      <div 
        className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg p-4 flex items-center justify-center min-h-[90px] border border-gray-600"
        style={style}
      >
        <p className="text-gray-400 text-sm text-center">
          Gli annunci appariranno qui quando il sito sarà approvato da AdSense
        </p>
      </div>
    </div>
  );
};

interface InterstitialAdProps {
  show: boolean;
  onClose: () => void;
}

export const InterstitialAd: React.FC<InterstitialAdProps> = ({ show, onClose }) => {
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (show) {
      setCanClose(false);
      setCountdown(5);
      
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanClose(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-lg w-full relative">
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-white hover:text-gray-300 text-xl font-bold z-10"
          >
            ✕
          </button>
        )}
        <p className="text-gray-400 text-xs text-center mb-4">Pubblicità</p>
        
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-lg p-8 flex flex-col items-center justify-center min-h-[250px] border border-gray-600">
          <p className="text-gray-400 text-center mb-4">
            Gli annunci appariranno qui quando il sito sarà approvato da AdSense
          </p>
          <p className="text-gray-500 text-sm">
            Grazie per supportare MINKIARDS!
          </p>
        </div>

        {!canClose ? (
          <p className="mt-4 text-center text-gray-400">
            Puoi chiudere tra {countdown} secondi...
          </p>
        ) : (
          <button
            onClick={onClose}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            Continua a giocare
          </button>
        )}
      </div>
    </div>
  );
};
