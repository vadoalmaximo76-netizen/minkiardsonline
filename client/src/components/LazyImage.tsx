import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  style,
  onClick,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    setIsLoaded(true);
    if (onError) onError(e);
  };

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`} style={style} onClick={onClick}>
      {!isLoaded && (
        <div 
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={style}
        >
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(145deg, rgba(30,20,60,0.9) 0%, rgba(50,30,80,0.7) 30%, rgba(20,40,70,0.8) 60%, rgba(40,20,70,0.9) 100%)',
              filter: 'blur(8px)',
            }}
          />
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: 'radial-gradient(ellipse at 50% 40%, rgba(147,51,234,0.15) 0%, transparent 70%)',
            }}
          >
            <div 
              className="rounded-lg animate-pulse"
              style={{
                width: '60%',
                height: '75%',
                background: 'linear-gradient(180deg, rgba(147,51,234,0.12) 0%, rgba(59,130,246,0.08) 50%, rgba(147,51,234,0.12) 100%)',
                border: '1px solid rgba(147,51,234,0.15)',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>
      )}
      
      {hasError && isLoaded && (
        <div 
          className="absolute inset-0 bg-slate-800 rounded-xl flex items-center justify-center"
          style={style}
        >
          <span className="text-red-400 text-xs">⚠️</span>
        </div>
      )}

      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className}`}
          style={{
            ...style,
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
            opacity: isLoaded ? 1 : 0,
            transform: isLoaded ? 'scale(1)' : 'scale(1.02)',
          }}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};

export default LazyImage;
