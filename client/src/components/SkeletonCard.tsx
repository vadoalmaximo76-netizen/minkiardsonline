import React from 'react';

interface SkeletonCardProps {
  count?: number;
  location?: 'hand' | 'field';
}

const SingleSkeleton: React.FC<{ location: 'hand' | 'field' }> = ({ location }) => (
  <div
    className="flex-shrink-0 relative rounded-xl skeleton-card"
    style={{
      width: location === 'hand' ? '5rem' : '5.5rem',
      height: location === 'hand' ? '7.5rem' : '8.25rem',
      opacity: 0.65,
    }}
  >
    <div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full"
      style={{
        width: '60%',
        height: '6px',
        background: 'rgba(255,255,255,0.07)',
      }}
    />
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full"
      style={{
        width: '45%',
        height: '6px',
        background: 'rgba(255,255,255,0.07)',
      }}
    />
  </div>
);

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1, location = 'hand' }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <SingleSkeleton key={i} location={location} />
    ))}
  </>
);
