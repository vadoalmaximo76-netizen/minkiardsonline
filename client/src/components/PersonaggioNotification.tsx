import React from 'react';

interface PersonaggioNotificationProps {
  isVisible: boolean;
  cardName: string;
  message: string;
  cardImage: string;
  onComplete?: () => void;
}

export const PersonaggioNotification: React.FC<PersonaggioNotificationProps> = ({
  isVisible,
  cardName,
  message,
  cardImage,
  onComplete
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="flex items-center gap-8">
        {/* Card Image with Zoom Animation */}
        {cardImage && (
          <div className="animate-in zoom-in-50 fade-in duration-500">
            <img
              src={cardImage}
              alt={cardName}
              className="w-32 h-44 rounded-lg border-4 border-orange-500 shadow-2xl"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(255, 165, 0, 0.8))',
                animation: 'zoom-pulse 1s ease-in-out infinite alternate'
              }}
              onError={(e) => {
                console.error('Failed to load card image:', cardImage);
                e.currentTarget.style.display = 'none';
              }}
              onLoad={() => {
                console.log('Card image loaded successfully:', cardImage);
              }}
            />
          </div>
        )}

        {/* Notification with Flames */}
        <div className="bg-black/80 border-4 border-orange-500 rounded-lg p-8 text-center relative overflow-hidden animate-in zoom-in-95 fade-in duration-500">
          {/* Moving Flames Background */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute bottom-0 w-4 h-8 bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400 rounded-full animate-pulse"
                style={{
                  left: `${10 + i * 12}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '1.5s',
                  transform: `scaleY(${0.8 + Math.random() * 0.4})`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-orange-600 via-red-500 to-yellow-300 rounded-full animate-bounce opacity-70"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '1s'
                  }}
                />
              </div>
            ))}
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <h2 className="text-4xl font-bold text-orange-400 mb-2 animate-pulse">
              🔥 {cardName} 🔥
            </h2>
            <p className="text-2xl font-bold text-red-400 tracking-wider animate-bounce">
              {message}
            </p>
          </div>
          
          {/* Additional flame effects */}
          <div className="absolute top-2 left-2 w-6 h-6 bg-gradient-to-t from-red-500 to-yellow-400 rounded-full animate-ping" />
          <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-t from-red-500 to-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-gradient-to-t from-orange-600 to-yellow-300 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};