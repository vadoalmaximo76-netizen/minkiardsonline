import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Lightbulb, X, Edit3, Save, Trash2, Bot, Plus } from 'lucide-react';
import { GameBoard } from './GameBoard';
import { socket } from '../lib/socket';
import { useGameState } from '../lib/stores/useGameState';

interface TrainingModeProps {
  playerName: string;
  userId?: number;
  avatarId?: string | null;
  userEmail?: string | null;
  onBack: () => void;
}

interface CardTip {
  id: number;
  cardName: string;
  cardType: string;
  tipTitle: string;
  tipContent: string;
  createdAt: string;
  updatedAt: string;
}

const ADMIN_EMAIL = 'lucaforte94@gmail.com';

export function TrainingMode({ playerName, userId, avatarId, userEmail, onBack }: TrainingModeProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentTip, setCurrentTip] = useState<CardTip | null>(null);
  const [shownTips, setShownTips] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTip, setEditingTip] = useState(false);
  const [editedTipContent, setEditedTipContent] = useState('');
  const [editedTipTitle, setEditedTipTitle] = useState('');
  const [allTips, setAllTips] = useState<CardTip[]>([]);
  const [showTipsManager, setShowTipsManager] = useState(false);
  const [cpuAdded, setCpuAdded] = useState(false);
  const [cpuName, setCpuName] = useState<string | null>(null);
  const [addingCpu, setAddingCpu] = useState(false);
  const [trainingGameId, setTrainingGameId] = useState<string | null>(null);
  const { setGameId, setPlayerName, generateSessionId, gameId } = useGameState();

  useEffect(() => {
    setIsAdmin(userEmail === ADMIN_EMAIL);
    
    const fetchTips = async () => {
      try {
        const res = await fetch('/api/training-tips');
        if (res.ok) {
          const tips = await res.json();
          setAllTips(tips);
        }
      } catch (error) {
        console.error('Error fetching tips:', error);
      }
    };
    
    fetchTips();
    
    const savedShownTips = localStorage.getItem('trainingShownTips');
    if (savedShownTips) {
      setShownTips(new Set(JSON.parse(savedShownTips)));
    }
  }, [userEmail]);

  const startTrainingGame = useCallback(() => {
    const newTrainingGameId = `training-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGameId(newTrainingGameId);
    setTrainingGameId(newTrainingGameId);
    setPlayerName(playerName);
    generateSessionId();
    
    socket.emit('create-training-game', {
      gameId: newTrainingGameId,
      playerName,
      avatarId,
      userId
    });
    
    setGameStarted(true);
  }, [playerName, avatarId, userId, setGameId, setPlayerName, generateSessionId]);

  const addCpuPlayer = useCallback(() => {
    if (!trainingGameId || addingCpu || cpuAdded) return;
    setAddingCpu(true);
    socket.emit('add-training-cpu', { gameId: trainingGameId });
  }, [trainingGameId, addingCpu, cpuAdded]);

  useEffect(() => {
    const handleCpuAdded = (data: { cpuName: string }) => {
      setCpuAdded(true);
      setCpuName(data.cpuName);
      setAddingCpu(false);
    };

    socket.on('training-cpu-added', handleCpuAdded);
    
    return () => {
      socket.off('training-cpu-added', handleCpuAdded);
    };
  }, []);

  // Separate effect for card-played tips to avoid re-registration issues
  useEffect(() => {
    if (!gameStarted || !trainingGameId) return;

    const handleCardPlayed = (data: { cardName: string; cardType: string; playerName: string; gameId?: string }) => {
      // Only process tips for the current training game
      const currentGameId = gameId || trainingGameId;
      if (data.gameId && data.gameId !== currentGameId) return;
      
      const tipKey = `${data.cardType}-${data.cardName}`;
      
      setShownTips(prevShownTips => {
        if (prevShownTips.has(tipKey)) return prevShownTips;
        
        const tip = allTips.find(t => 
          t.cardName.toLowerCase() === data.cardName.toLowerCase() ||
          t.cardType.toLowerCase() === data.cardType.toLowerCase()
        );
        
        if (tip) {
          setCurrentTip(tip);
          const newShownTips = new Set(prevShownTips);
          newShownTips.add(tipKey);
          localStorage.setItem('trainingShownTips', JSON.stringify(Array.from(newShownTips)));
          return newShownTips;
        }
        return prevShownTips;
      });
    };

    socket.on('card-played', handleCardPlayed);
    
    return () => {
      socket.off('card-played', handleCardPlayed);
    };
  }, [gameStarted, trainingGameId, gameId, allTips]);

  const handleSaveTip = async () => {
    if (!currentTip) return;
    
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`/api/training-tips/${currentTip.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tipTitle: editedTipTitle,
          tipContent: editedTipContent
        })
      });
      
      if (res.ok) {
        const updatedTip = await res.json();
        setCurrentTip(updatedTip);
        setAllTips(prev => prev.map(t => t.id === updatedTip.id ? updatedTip : t));
        setEditingTip(false);
      }
    } catch (error) {
      console.error('Error saving tip:', error);
    }
  };

  const handleCreateTip = async (cardName: string, cardType: string) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/training-tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          cardName,
          cardType,
          tipTitle: `Come usare ${cardName}`,
          tipContent: 'Inserisci qui la descrizione di come usare questa carta.'
        })
      });
      
      if (res.ok) {
        const newTip = await res.json();
        setAllTips(prev => [...prev, newTip]);
        setCurrentTip(newTip);
        setEditingTip(true);
        setEditedTipTitle(newTip.tipTitle);
        setEditedTipContent(newTip.tipContent);
      }
    } catch (error) {
      console.error('Error creating tip:', error);
    }
  };

  const handleDeleteTip = async (tipId: number) => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`/api/training-tips/${tipId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (res.ok) {
        setAllTips(prev => prev.filter(t => t.id !== tipId));
        if (currentTip?.id === tipId) {
          setCurrentTip(null);
        }
      }
    } catch (error) {
      console.error('Error deleting tip:', error);
    }
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Same background as home page */}
        <div 
          className="fixed inset-0 bg-cover bg-center opacity-50"
          style={{
            backgroundImage: 'url(https://files.123freevectors.com/wp-content/original/113342-royal-blue-blurred-background-vector.jpg)'
          }}
        />
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="max-w-lg w-full text-center relative z-10">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
            <Lightbulb className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Modalità Allenamento</h1>
          <p className="text-white/80 text-lg mb-8 font-medium">
            Impara a giocare a MINKIARDS contro un avversario CPU. 
            Riceverai suggerimenti e spiegazioni mentre giochi.
          </p>
          
          <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 mb-8 text-left border border-emerald-500/30 shadow-xl">
            <h3 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Cosa imparerai:
            </h3>
            <ul className="space-y-2 text-white/90">
              <li>• Come funzionano le carte PERSONAGGI</li>
              <li>• Come usare le carte MOSSE per attaccare</li>
              <li>• Come applicare le carte BONUS ai personaggi</li>
              <li>• Strategie di base per vincere</li>
              <li>• Effetti speciali e combinazioni</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onBack}
              className="flex-1 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5 inline mr-2" />
              Indietro
            </button>
            <button
              onClick={startTrainingGame}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-emerald-500/30"
            >
              Inizia Allenamento
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowTipsManager(true)}
              className="mt-4 px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl font-medium transition-colors w-full"
            >
              <Edit3 className="w-5 h-5 inline mr-2" />
              Gestisci Tips (Admin)
            </button>
          )}
        </div>

        {/* Tips Manager Modal for Admin */}
        {showTipsManager && isAdmin && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Gestione Tips</h2>
                <button onClick={() => setShowTipsManager(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {allTips.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Nessun tip creato ancora.</p>
                ) : (
                  <div className="space-y-4">
                    {allTips.map(tip => (
                      <div key={tip.id} className="bg-slate-700/50 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-white">{tip.tipTitle}</h3>
                            <p className="text-sm text-slate-400">{tip.cardType} - {tip.cardName}</p>
                            <p className="text-slate-300 mt-2">{tip.tipContent}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteTip(tip.id)}
                            className="text-red-400 hover:text-red-300 p-2"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Training Game */}
      <GameBoard 
        authenticatedUser={{ id: userId || 0, username: playerName, email: userEmail || null, avatar: avatarId || null }}
        onLogout={onBack}
        authToken={localStorage.getItem('authToken')}
      />

      {/* Back button overlay */}
      <button
        onClick={onBack}
        className="fixed top-4 left-4 z-50 p-3 bg-slate-800/90 hover:bg-slate-700 rounded-xl text-white transition-colors backdrop-blur-sm"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* Training badge */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500/90 text-white rounded-full font-medium backdrop-blur-sm flex items-center gap-2">
        <Lightbulb className="w-5 h-5" />
        Modalità Allenamento
      </div>

      {/* Add CPU button */}
      {!cpuAdded && trainingGameId && (
        <button
          onClick={addCpuPlayer}
          disabled={addingCpu || !trainingGameId}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-blue-500/90 hover:bg-blue-600/90 disabled:bg-slate-500/50 text-white rounded-xl font-medium backdrop-blur-sm flex items-center gap-2 transition-colors"
        >
          {addingCpu ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Aggiungendo CPU...
            </>
          ) : (
            <>
              <Bot className="w-5 h-5" />
              <Plus className="w-4 h-4" />
              Aggiungi Avversario CPU
            </>
          )}
        </button>
      )}

      {/* CPU added notification */}
      {cpuAdded && cpuName && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-green-500/90 text-white rounded-xl font-medium backdrop-blur-sm flex items-center gap-2">
          <Bot className="w-5 h-5" />
          {cpuName} aggiunto!
        </div>
      )}

      {/* Tip Modal */}
      {currentTip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-2xl max-w-md w-full p-6 border border-emerald-500/30 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  {editingTip ? (
                    <input
                      type="text"
                      value={editedTipTitle}
                      onChange={(e) => setEditedTipTitle(e.target.value)}
                      className="bg-slate-700 text-white px-3 py-1 rounded-lg font-semibold"
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-white">{currentTip.tipTitle}</h3>
                  )}
                  <p className="text-emerald-400 text-sm">{currentTip.cardType}</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentTip(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {editingTip ? (
              <textarea
                value={editedTipContent}
                onChange={(e) => setEditedTipContent(e.target.value)}
                className="w-full h-32 bg-slate-700 text-white p-3 rounded-xl resize-none"
              />
            ) : (
              <p className="text-slate-200 leading-relaxed">{currentTip.tipContent}</p>
            )}
            
            <div className="mt-6 flex gap-3">
              {isAdmin && (
                editingTip ? (
                  <button
                    onClick={handleSaveTip}
                    className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Salva
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingTip(true);
                      setEditedTipTitle(currentTip.tipTitle);
                      setEditedTipContent(currentTip.tipContent);
                    }}
                    className="flex-1 px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-5 h-5" />
                    Modifica
                  </button>
                )
              )}
              <button
                onClick={() => {
                  setCurrentTip(null);
                  setEditingTip(false);
                }}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium"
              >
                Ho capito!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
