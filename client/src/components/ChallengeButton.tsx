import React, { useState, useEffect } from 'react';
import { Sword, Loader2 } from 'lucide-react';

interface ChallengeButtonProps {
  targetUsername: string;
  currentUserId?: number;
  className?: string;
}

export function ChallengeButton({ targetUsername, className = "" }: ChallengeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    setCurrentUsername(storedUsername);
  }, []);

  // Don't show the button if it's the current user
  if (currentUsername === targetUsername) {
    return null;
  }

  const handleChallenge = async () => {
    if (loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUsername }),
      });

      if (response.ok) {
        setFeedback('Sfida inviata!');
      } else {
        setFeedback('Errore');
      }
    } catch (error) {
      setFeedback('Errore');
    } finally {
      setLoading(false);
      setTimeout(() => {
        setFeedback(null);
      }, 2000);
    }
  };

  const buttonBaseClass = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const challengeStyle = "bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 px-3 py-1.5 shadow-sm";

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={handleChallenge}
        disabled={loading || feedback !== null}
        className={`${buttonBaseClass} ${challengeStyle}`}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sword className="mr-2 h-4 w-4" />
        )}
        ⚔️ Sfida
      </button>

      {feedback && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-xs font-semibold px-2 py-1 rounded bg-white border shadow-md animate-in fade-in slide-in-from-top-1">
          <span className={feedback === 'Errore' ? 'text-red-500' : 'text-green-600'}>
            {feedback}
          </span>
        </div>
      )}
    </div>
  );
}
