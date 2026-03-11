import React from "react";

type AppSection = 'home' | 'play' | 'training' | 'rooms' | 'profile' | 'spectator' | 'admin' | 'draft' | 'leaderboard' | 'tournaments' | 'fanta';

interface BottomNavProps {
  currentSection: AppSection;
  onNavigate: (section: AppSection) => void;
  hasActiveGame?: boolean;
}

const NAV_ITEMS = [
  {
    section: 'home' as AppSection,
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9" fill={active ? 'rgba(0,0,0,0.3)' : 'none'} stroke={active ? 'rgba(0,0,0,0.4)' : 'currentColor'} strokeWidth={active ? 1 : 2}/>
      </svg>
    ),
  },
  {
    section: 'play' as AppSection,
    label: 'Gioca',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" fill={active ? 'currentColor' : 'none'}/>
      </svg>
    ),
    isPrimary: true,
  },
  {
    section: 'draft' as AppSection,
    label: 'Draft',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" fill={active ? 'currentColor' : 'none'} fillOpacity={0.2}/>
        <path d="M8 4v16M16 4v16" strokeOpacity={active ? 0.6 : 1}/>
        <path d="M2 12h20" strokeOpacity={active ? 0.6 : 1}/>
      </svg>
    ),
  },
  {
    section: 'tournaments' as AppSection,
    label: 'Tornei',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4a2 2 0 0 1-2-2V5h4" fill={active ? 'currentColor' : 'none'} fillOpacity={0.2}/>
        <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" fill={active ? 'currentColor' : 'none'} fillOpacity={0.2}/>
        <path d="M6 5h12v8a6 6 0 0 1-6 6 6 6 0 0 1-6-6V5z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.2 : 0}/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="8" y1="22" x2="16" y2="22"/>
      </svg>
    ),
  },
  {
    section: 'fanta' as AppSection,
    label: 'Fanta',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" fill={active ? 'currentColor' : 'none'} fillOpacity={0.15}/>
        <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2z"/>
        <path d="M2 12h20M12 2c-2.8 3.3-4 6.5-4 10s1.2 6.7 4 10M12 2c2.8 3.3 4 6.5 4 10s-1.2 6.7-4 10" strokeOpacity={0.7}/>
      </svg>
    ),
  },
];

export function BottomNav({ currentSection, onNavigate, hasActiveGame = false }: BottomNavProps) {
  return (
    <>
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(7, 11, 26, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(139, 92, 246, 0.18)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.5), 0 -1px 0 rgba(139,92,246,0.1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = currentSection === item.section ||
            (item.section === 'play' && currentSection === 'rooms');

          return (
            <button
              key={item.section}
              onClick={() => onNavigate(item.section)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: item.isPrimary ? '6px 4px 8px' : '10px 4px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {item.isPrimary ? (
                <div style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: isActive
                    ? 'linear-gradient(135deg, #9333ea, #7c3aed)'
                    : 'linear-gradient(135deg, #1e1b4b, #312e81)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: isActive
                    ? '0 0 20px rgba(147,51,234,0.7), 0 4px 12px rgba(0,0,0,0.4)'
                    : '0 0 0 rgba(0,0,0,0), 0 2px 8px rgba(0,0,0,0.3)',
                  border: isActive
                    ? '1.5px solid rgba(196,148,253,0.6)'
                    : '1.5px solid rgba(99,102,241,0.3)',
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  marginBottom: 0,
                }}>
                  {item.icon(isActive)}
                  {hasActiveGame && (
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      background: '#22c55e',
                      borderRadius: '50%',
                      border: '2px solid #070b1a',
                    }} />
                  )}
                </div>
              ) : (
                <div style={{
                  position: 'relative',
                  color: isActive ? '#c084fc' : 'rgba(148,163,184,0.6)',
                  transition: 'color 0.2s, transform 0.2s',
                  transform: isActive ? 'scale(1.12) translateY(-1px)' : 'scale(1)',
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(192,132,252,0.7))' : 'none',
                }}>
                  {item.icon(isActive)}
                </div>
              )}

              {!item.isPrimary && (
                <span style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#c084fc' : 'rgba(148,163,184,0.5)',
                  letterSpacing: '0.03em',
                  transition: 'color 0.2s',
                  lineHeight: 1,
                }}>
                  {item.label}
                </span>
              )}

              {isActive && !item.isPrimary && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24,
                  height: 2,
                  borderRadius: 2,
                  background: 'linear-gradient(90deg, #9333ea, #c084fc)',
                  boxShadow: '0 0 8px rgba(192,132,252,0.8)',
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div
        className="md:hidden"
        style={{
          height: `calc(64px + env(safe-area-inset-bottom, 0px))`,
          flexShrink: 0,
        }}
      />
    </>
  );
}
