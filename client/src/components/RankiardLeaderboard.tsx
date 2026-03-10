import React from "react";

interface RankiardLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  currentGameId?: string;
}

export const RankiardLeaderboard: React.FC<RankiardLeaderboardProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentGameId
}) => {
  console.log('RankiardLeaderboard render:', { isOpen, currentGameId });
  
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        background: '#ff0000',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <h1 style={{ color: 'white', fontSize: 48, margin: 0 }}>🔴 LEADERBOARD</h1>
      <button
        onClick={onClose}
        style={{
          marginTop: 32,
          padding: '12px 24px',
          fontSize: 18,
          background: 'white',
          color: 'red',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        Chiudi
      </button>
    </div>
  );
};

export default RankiardLeaderboard;
