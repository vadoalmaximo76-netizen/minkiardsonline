import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface YouTubeVideoModalProps {
  youtubeUrl: string;
  cardName: string;
  playerName: string;
  onClose: () => void;
}

const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

export const YouTubeVideoModal: React.FC<YouTubeVideoModalProps> = ({
  youtubeUrl,
  cardName,
  playerName,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const videoId = extractVideoId(youtubeUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!videoId) {
    console.error('Invalid YouTube URL:', youtubeUrl);
    setTimeout(onClose, 1000);
    return null;
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1`;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
    >
      <div 
        className={`relative bg-gray-900 rounded-2xl shadow-2xl border-4 border-red-600 overflow-hidden transition-transform duration-300 ${
          isVisible ? 'scale-100' : 'scale-75'
        }`}
        style={{ 
          width: 'min(90vw, 960px)', 
          maxHeight: '90vh'
        }}
      >
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-lg">
              {cardName}
            </span>
            <span className="text-red-200 text-sm">
              - giocata da {playerName}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 bg-red-800 hover:bg-red-900 rounded-full transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={`Video di ${cardName}`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="bg-gray-800 px-6 py-3 flex justify-center">
          <button
            onClick={handleClose}
            className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <X size={18} />
            CHIUDI VIDEO
          </button>
        </div>
      </div>
    </div>
  );
};
