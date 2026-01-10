import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdBannerProps {
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const AdBanner: React.FC<AdBannerProps> = ({ 
  slot = '', 
  format = 'auto', 
  responsive = true,
  className = '',
  style = {}
}) => {
  const adRef = useRef<HTMLModElement>(null);
  const isAdPushed = useRef(false);

  useEffect(() => {
    if (adRef.current && !isAdPushed.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isAdPushed.current = true;
      } catch (e) {
        console.error('AdSense error:', e);
      }
    }
  }, []);

  return (
    <div className={`ad-container ${className}`} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client="ca-pub-5660517743209013"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
};

interface InterstitialAdProps {
  show: boolean;
  onClose: () => void;
  slot?: string;
}

export const InterstitialAd: React.FC<InterstitialAdProps> = ({ show, onClose, slot = '' }) => {
  const adRef = useRef<HTMLModElement>(null);
  const isAdPushed = useRef(false);

  useEffect(() => {
    if (show && adRef.current && !isAdPushed.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isAdPushed.current = true;
      } catch (e) {
        console.error('AdSense interstitial error:', e);
      }
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 rounded-lg p-4 max-w-lg w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white hover:text-gray-300 text-xl font-bold z-10"
        >
          ✕
        </button>
        <p className="text-gray-400 text-xs text-center mb-2">Pubblicità</p>
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', minHeight: '250px' }}
          data-ad-client="ca-pub-5660517743209013"
          data-ad-slot={slot}
          data-ad-format="rectangle"
        />
        <button
          onClick={onClose}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Continua
        </button>
      </div>
    </div>
  );
};
