import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  skipTutorial?: boolean;
  isOfflineMode?: boolean;
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

interface TutorialStep {
  id: number;
  stepId: string;
  trigger: string;
  title: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
}

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    trigger: 'game_start',
    title: 'Benvenuto in MINKIARDS!',
    content: 'Questa è una partita di allenamento. Ti guiderò passo passo per imparare a giocare. Clicca "Avanti" per continuare.',
  },
  {
    id: 'deck_overview',
    trigger: 'game_start',
    title: 'I Mazzi di Carte',
    content: 'Hai 4 mazzi: PERSONAGGI (rosso), MOSSE (blu), BONUS (verde) e SPECIALI (viola). Ogni mazzo ha un ruolo diverso nel gioco.',
  },
  {
    id: 'draw_card',
    trigger: 'game_start',
    title: 'Pescare le Carte',
    content: 'Clicca su un mazzo per pescare una carta. Inizia pescando una carta PERSONAGGI - sono i tuoi combattenti!',
  },
  {
    id: 'play_character',
    trigger: 'card_drawn',
    title: 'Giocare un Personaggio',
    content: 'Ottimo! Hai pescato una carta. Ora clicca sulla carta nella tua mano e poi su uno slot vuoto del campo per posizionarla.',
  },
  {
    id: 'character_stats',
    trigger: 'character_played',
    title: 'Statistiche Personaggio',
    content: 'Ogni personaggio ha PTI (punti vita) e Stelle (potenza). Quando i PTI arrivano a 0, il personaggio muore.',
  },
  {
    id: 'mosse_attack',
    trigger: 'character_played',
    title: 'Usare le MOSSE',
    content: 'Pesca una carta MOSSE per attaccare! Seleziona la MOSSA, poi il tuo personaggio, infine il bersaglio nemico.',
  },
  {
    id: 'bonus_cards',
    trigger: 'mosse_played',
    title: 'Carte BONUS',
    content: 'Le carte BONUS potenziano i tuoi personaggi! Pesca una BONUS e applicala a un tuo personaggio sul campo.',
  },
  {
    id: 'turn_end',
    trigger: 'bonus_played',
    title: 'Fine Turno',
    content: 'Puoi giocare più carte per turno. Quando hai finito, il turno passerà automaticamente o puoi passarlo manualmente.',
  },
  {
    id: 'win_condition',
    trigger: 'turn_ended',
    title: 'Come Vincere',
    content: 'Vinci eliminando tutti i personaggi nemici o facendo scendere i punti vita dell\'avversario a 0. Buon divertimento!',
  },
];

export function TrainingMode({ playerName, userId, avatarId, userEmail, onBack, skipTutorial = false, isOfflineMode = false }: TrainingModeProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentTip, setCurrentTip] = useState<CardTip | null>(null);
  const [shownTips, setShownTips] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingTip, setEditingTip] = useState(false);
  const [editedTipContent, setEditedTipContent] = useState('');
  const [editedTipTitle, setEditedTipTitle] = useState('');
  const [allTips, setAllTips] = useState<CardTip[]>([]);
  const [showTipsManager, setShowTipsManager] = useState(false);
  const [managerEditingTip, setManagerEditingTip] = useState<CardTip | null>(null);
  const [managerNewTip, setManagerNewTip] = useState(false);
  const [managerTipTitle, setManagerTipTitle] = useState('');
  const [managerTipContent, setManagerTipContent] = useState('');
  const [managerCardName, setManagerCardName] = useState('');
  const [managerCardType, setManagerCardType] = useState('personaggi');
  const [cpuAdded, setCpuAdded] = useState(false);
  const [cpuName, setCpuName] = useState<string | null>(null);
  const [addingCpu, setAddingCpu] = useState(false);
  const [trainingGameId, setTrainingGameId] = useState<string | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const shouldShowTutorial = !skipTutorial && !isOfflineMode;
  const [completedTutorialSteps, setCompletedTutorialSteps] = useState<Set<string>>(new Set());
  const [dbTutorialSteps, setDbTutorialSteps] = useState<TutorialStep[]>([]);
  const [managerTab, setManagerTab] = useState<'tips' | 'tutorial'>('tips');
  const [editingTutorialStep, setEditingTutorialStep] = useState<TutorialStep | null>(null);
  const [tutorialStepTitle, setTutorialStepTitle] = useState('');
  const [tutorialStepContent, setTutorialStepContent] = useState('');
  const [tutorialStepTrigger, setTutorialStepTrigger] = useState('game_start');
  const { setGameId, setPlayerName, generateSessionId, gameId } = useGameState();

  // Use database tutorial steps if available, otherwise fallback to hardcoded defaults
  const activeTutorialSteps = useMemo(() => {
    if (dbTutorialSteps.length > 0) {
      // Convert database format to expected format
      return dbTutorialSteps.map(step => ({
        id: step.stepId,
        trigger: step.trigger,
        title: step.title,
        content: step.content
      }));
    }
    return TUTORIAL_STEPS;
  }, [dbTutorialSteps]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          const res = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setIsAdmin(data.profile?.user?.isAdmin || false);
          }
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
    
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
    
    const fetchTutorialSteps = async () => {
      try {
        const res = await fetch('/api/tutorial-steps');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.steps.length > 0) {
            setDbTutorialSteps(data.steps);
          }
        }
      } catch (error) {
        console.error('Error fetching tutorial steps:', error);
      }
    };
    
    fetchTips();
    fetchTutorialSteps();
    
    const savedShownTips = localStorage.getItem('trainingShownTips');
    if (savedShownTips) {
      setShownTips(new Set(JSON.parse(savedShownTips)));
    }
  }, [userEmail]);

  const startTrainingGame = useCallback(() => {
    const gamePrefix = isOfflineMode ? 'offline' : 'training';
    const newTrainingGameId = `${gamePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    
    // Start tutorial after a short delay (only if not in offline/skip mode)
    if (shouldShowTutorial) {
      setTimeout(() => {
        setShowTutorial(true);
        setTutorialStep(0);
      }, 1500);
    }
  }, [playerName, avatarId, userId, setGameId, setPlayerName, generateSessionId, shouldShowTutorial, isOfflineMode]);

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

  // Generic tutorial progression handler
  const advanceTutorialForTrigger = useCallback((trigger: string) => {
    // Find next uncompleted step for this trigger
    setCompletedTutorialSteps(prev => {
      const nextStepIndex = activeTutorialSteps.findIndex(s => s.trigger === trigger && !prev.has(s.id));
      
      if (nextStepIndex !== -1) {
        const stepId = activeTutorialSteps[nextStepIndex].id;
        console.log(`Tutorial: trigger "${trigger}" -> showing step ${nextStepIndex + 1}/${activeTutorialSteps.length} (${stepId})`);
        
        setTimeout(() => {
          setTutorialStep(nextStepIndex);
          setShowTutorial(true);
        }, 500);
        
        // Mark this step as shown (will be completed when user clicks "Avanti")
        return prev;
      }
      
      return prev;
    });
  }, [activeTutorialSteps]);

  // Tutorial progression based on game events
  useEffect(() => {
    if (!gameStarted || !trainingGameId) return;

    const handleCardDrawn = () => {
      console.log('Tutorial: card-picked-private event received');
      advanceTutorialForTrigger('card_drawn');
    };
    
    const handleCardPlayed = (data: { cardType?: string; deckType?: string }) => {
      console.log('Tutorial: card-played event received', data);
      const cardType = (data.cardType || data.deckType || '').toLowerCase();
      
      if (cardType === 'personaggi' || cardType === 'personaggi_speciali') {
        advanceTutorialForTrigger('character_played');
      } else if (cardType === 'mosse') {
        advanceTutorialForTrigger('mosse_played');
      } else if (cardType === 'bonus') {
        advanceTutorialForTrigger('bonus_played');
      }
    };
    
    const handleTurnEnded = () => {
      console.log('Tutorial: next-turn event received');
      advanceTutorialForTrigger('turn_ended');
    };

    socket.on('card-picked-private', handleCardDrawn);
    socket.on('card-played', handleCardPlayed);
    socket.on('next-turn', handleTurnEnded);
    
    return () => {
      socket.off('card-picked-private', handleCardDrawn);
      socket.off('card-played', handleCardPlayed);
      socket.off('next-turn', handleTurnEnded);
    };
  }, [gameStarted, trainingGameId, advanceTutorialForTrigger]);

  const handleNextTutorialStep = () => {
    const currentStepId = activeTutorialSteps[tutorialStep]?.id;
    if (currentStepId) {
      setCompletedTutorialSteps(prev => new Set([...Array.from(prev), currentStepId]));
    }
    
    if (tutorialStep < activeTutorialSteps.length - 1) {
      const nextStep = tutorialStep + 1;
      const nextTrigger = activeTutorialSteps[nextStep]?.trigger;
      
      // If next step has same trigger, show it immediately
      if (nextTrigger === activeTutorialSteps[tutorialStep]?.trigger) {
        setTutorialStep(nextStep);
      } else {
        setShowTutorial(false);
      }
    } else {
      setShowTutorial(false);
    }
  };

  const handleSkipTutorial = () => {
    setShowTutorial(false);
    setCompletedTutorialSteps(new Set(activeTutorialSteps.map(s => s.id)));
  };

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

  const handleManagerSaveTip = async () => {
    if (!managerEditingTip) return;
    
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`/api/training-tips/${managerEditingTip.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          tipTitle: managerTipTitle,
          tipContent: managerTipContent
        })
      });
      
      if (res.ok) {
        const updatedTip = await res.json();
        setAllTips(prev => prev.map(t => t.id === updatedTip.id ? updatedTip : t));
        setManagerEditingTip(null);
        setManagerTipTitle('');
        setManagerTipContent('');
      }
    } catch (error) {
      console.error('Error saving tip:', error);
    }
  };

  const handleManagerCreateTip = async () => {
    if (!managerTipTitle.trim() || !managerTipContent.trim()) return;
    
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/training-tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          cardName: managerCardName.trim() || 'Generale',
          cardType: managerCardType,
          tipTitle: managerTipTitle,
          tipContent: managerTipContent
        })
      });
      
      if (res.ok) {
        const newTip = await res.json();
        setAllTips(prev => [...prev, newTip]);
        setManagerNewTip(false);
        setManagerTipTitle('');
        setManagerTipContent('');
        setManagerCardName('');
        setManagerCardType('personaggi');
      }
    } catch (error) {
      console.error('Error creating tip:', error);
    }
  };

  const startEditTip = (tip: CardTip) => {
    setManagerEditingTip(tip);
    setManagerTipTitle(tip.tipTitle);
    setManagerTipContent(tip.tipContent);
    setManagerNewTip(false);
  };

  const startNewTip = () => {
    setManagerNewTip(true);
    setManagerEditingTip(null);
    setManagerTipTitle('');
    setManagerTipContent('');
    setManagerCardName('');
    setManagerCardType('personaggi');
  };

  const cancelManagerEdit = () => {
    setManagerEditingTip(null);
    setManagerNewTip(false);
    setManagerTipTitle('');
    setManagerTipContent('');
    setManagerCardName('');
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
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl ${isOfflineMode ? 'bg-gradient-to-br from-slate-500 to-gray-600 shadow-slate-500/30' : 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'}`}>
            <Lightbulb className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">
            {isOfflineMode ? 'Modalità Offline' : 'Modalità Allenamento'}
          </h1>
          <p className="text-white/80 text-lg mb-8 font-medium">
            {isOfflineMode 
              ? 'Gioca a MINKIARDS contro la CPU anche senza connessione internet. Stessa esperienza di gioco completa!'
              : 'Impara a giocare a MINKIARDS contro un avversario CPU. Riceverai suggerimenti e spiegazioni mentre giochi.'}
          </p>
          
          {!isOfflineMode && (
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
          )}

          {isOfflineMode && (
            <div className="bg-slate-900/70 backdrop-blur-sm rounded-2xl p-6 mb-8 text-left border border-slate-500/30 shadow-xl">
              <h3 className="text-slate-300 font-semibold mb-3 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Partita Offline:
              </h3>
              <ul className="space-y-2 text-white/90">
                <li>• Gioca contro la CPU intelligente</li>
                <li>• Tutte le carte e meccaniche disponibili</li>
                <li>• Nessuna connessione richiesta</li>
                <li>• Stessa esperienza del multiplayer</li>
              </ul>
            </div>
          )}

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
              className={`flex-1 px-6 py-4 text-white rounded-xl font-bold text-lg transition-all hover:scale-105 shadow-lg ${isOfflineMode ? 'bg-gradient-to-r from-slate-500 to-gray-500 hover:from-slate-400 hover:to-gray-400 shadow-slate-500/30' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30'}`}
            >
              {isOfflineMode ? 'Inizia Partita' : 'Inizia Allenamento'}
            </button>
          </div>

          {isAdmin && !isOfflineMode && (
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
                <h2 className="text-xl font-bold text-white">Gestione Allenamento</h2>
                <button onClick={() => { setShowTipsManager(false); cancelManagerEdit(); setEditingTutorialStep(null); }} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setManagerTab('tips')}
                  className={`flex-1 px-4 py-3 font-medium transition-colors ${managerTab === 'tips' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Tips Carte
                </button>
                <button
                  onClick={() => setManagerTab('tutorial')}
                  className={`flex-1 px-4 py-3 font-medium transition-colors ${managerTab === 'tutorial' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Tutorial Automatico
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[55vh]">
              
              {managerTab === 'tips' && (
                <div>
                  <div className="flex justify-end mb-4">
                    {!managerNewTip && !managerEditingTip && (
                      <button 
                        onClick={startNewTip}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Nuovo Tip
                      </button>
                    )}
                  </div>
                {(managerNewTip || managerEditingTip) ? (
                  <div className="bg-slate-700/50 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white">
                      {managerNewTip ? 'Crea Nuovo Tip' : 'Modifica Tip'}
                    </h3>
                    
                    {managerNewTip && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Nome Carta (opzionale)</label>
                          <input
                            type="text"
                            value={managerCardName}
                            onChange={(e) => setManagerCardName(e.target.value)}
                            placeholder="es. Goku, Vegeta..."
                            className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-1">Tipo Carta</label>
                          <select
                            value={managerCardType}
                            onChange={(e) => setManagerCardType(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                          >
                            <option value="personaggi">Personaggi</option>
                            <option value="mosse">Mosse</option>
                            <option value="bonus">Bonus</option>
                            <option value="speciali">Speciali</option>
                          </select>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Titolo</label>
                      <input
                        type="text"
                        value={managerTipTitle}
                        onChange={(e) => setManagerTipTitle(e.target.value)}
                        placeholder="Titolo del tip..."
                        className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Contenuto</label>
                      <textarea
                        value={managerTipContent}
                        onChange={(e) => setManagerTipContent(e.target.value)}
                        placeholder="Descrizione del tip..."
                        rows={4}
                        className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 resize-none"
                      />
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={cancelManagerEdit}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={managerNewTip ? handleManagerCreateTip : handleManagerSaveTip}
                        disabled={!managerTipTitle.trim() || !managerTipContent.trim()}
                        className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        {managerNewTip ? 'Crea Tip' : 'Salva Modifiche'}
                      </button>
                    </div>
                  </div>
                ) : allTips.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">Nessun tip creato ancora. Clicca "Nuovo Tip" per iniziare.</p>
                ) : (
                  <div className="space-y-4">
                    {allTips.map(tip => (
                      <div key={tip.id} className="bg-slate-700/50 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">{tip.tipTitle}</h3>
                            <p className="text-sm text-slate-400">{tip.cardType} - {tip.cardName}</p>
                            <p className="text-slate-300 mt-2">{tip.tipContent}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => startEditTip(tip)}
                              className="text-blue-400 hover:text-blue-300 p-2"
                              title="Modifica"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTip(tip.id)}
                              className="text-red-400 hover:text-red-300 p-2"
                              title="Elimina"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              )}
              
              {managerTab === 'tutorial' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-slate-400 text-sm">Modifica i testi del tutorial automatico</p>
                    {dbTutorialSteps.length === 0 && (
                      <button
                        onClick={async () => {
                          const authToken = localStorage.getItem('authToken');
                          const res = await fetch('/api/tutorial-steps/initialize', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${authToken}` }
                          });
                          if (res.ok) {
                            const stepsRes = await fetch('/api/tutorial-steps');
                            if (stepsRes.ok) {
                              const data = await stepsRes.json();
                              setDbTutorialSteps(data.steps || []);
                            }
                          }
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium"
                      >
                        Inizializza Tutorial
                      </button>
                    )}
                  </div>
                  
                  {editingTutorialStep ? (
                    <div className="bg-slate-700/50 rounded-xl p-6 space-y-4">
                      <h3 className="text-lg font-semibold text-white">Modifica Step Tutorial</h3>
                      
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Trigger</label>
                        <select
                          value={tutorialStepTrigger}
                          onChange={(e) => setTutorialStepTrigger(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                        >
                          <option value="game_start">Inizio Gioco</option>
                          <option value="card_drawn">Carta Pescata</option>
                          <option value="character_played">Personaggio Giocato</option>
                          <option value="mosse_played">Mossa Usata</option>
                          <option value="bonus_played">Bonus Applicato</option>
                          <option value="turn_ended">Turno Finito</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Titolo</label>
                        <input
                          type="text"
                          value={tutorialStepTitle}
                          onChange={(e) => setTutorialStepTitle(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Contenuto</label>
                        <textarea
                          value={tutorialStepContent}
                          onChange={(e) => setTutorialStepContent(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white resize-none"
                        />
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setEditingTutorialStep(null)}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium"
                        >
                          Annulla
                        </button>
                        <button
                          onClick={async () => {
                            const authToken = localStorage.getItem('authToken');
                            const res = await fetch(`/api/tutorial-steps/${editingTutorialStep.id}`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                              },
                              body: JSON.stringify({
                                trigger: tutorialStepTrigger,
                                title: tutorialStepTitle,
                                content: tutorialStepContent
                              })
                            });
                            if (res.ok) {
                              const stepsRes = await fetch('/api/tutorial-steps');
                              if (stepsRes.ok) {
                                const data = await stepsRes.json();
                                setDbTutorialSteps(data.steps || []);
                              }
                              setEditingTutorialStep(null);
                            }
                          }}
                          disabled={!tutorialStepTitle.trim() || !tutorialStepContent.trim()}
                          className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-500 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Salva Modifiche
                        </button>
                      </div>
                    </div>
                  ) : dbTutorialSteps.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">Nessuno step tutorial configurato. Clicca "Inizializza Tutorial" per creare gli step predefiniti.</p>
                  ) : (
                    <div className="space-y-3">
                      {dbTutorialSteps.map((step, idx) => (
                        <div key={step.id} className="bg-slate-700/50 rounded-xl p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">{idx + 1}</span>
                                <h3 className="font-semibold text-white">{step.title}</h3>
                              </div>
                              <p className="text-xs text-amber-400 mb-1">Trigger: {step.trigger}</p>
                              <p className="text-slate-300 text-sm">{step.content}</p>
                            </div>
                            <button
                              onClick={() => {
                                setEditingTutorialStep(step);
                                setTutorialStepTitle(step.title);
                                setTutorialStepContent(step.content);
                                setTutorialStepTrigger(step.trigger);
                              }}
                              className="text-blue-400 hover:text-blue-300 p-2 ml-2"
                              title="Modifica"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Training/Offline badge */}
      <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-white rounded-full font-medium backdrop-blur-sm flex items-center gap-2 ${isOfflineMode ? 'bg-slate-500/90' : 'bg-emerald-500/90'}`}>
        {isOfflineMode ? <Bot className="w-5 h-5" /> : <Lightbulb className="w-5 h-5" />}
        {isOfflineMode ? 'Modalità Offline' : 'Modalità Allenamento'}
      </div>

      
      {/* Tutorial Modal */}
      {showTutorial && activeTutorialSteps[tutorialStep] && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4 pb-32">
          <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl max-w-lg w-full p-6 border border-blue-500/30 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-7 h-7 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">{activeTutorialSteps[tutorialStep].title}</h3>
                  <span className="text-blue-400 text-sm">{tutorialStep + 1}/{activeTutorialSteps.length}</span>
                </div>
                <p className="text-blue-200 mt-2 leading-relaxed">{activeTutorialSteps[tutorialStep].content}</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSkipTutorial}
                className="px-4 py-2 text-blue-400 hover:text-white hover:bg-blue-800/50 rounded-xl font-medium transition-colors"
              >
                Salta Tutorial
              </button>
              <button
                onClick={handleNextTutorialStep}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
              >
                {tutorialStep < activeTutorialSteps.length - 1 ? 'Avanti' : 'Fine Tutorial'}
              </button>
            </div>
            
            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {activeTutorialSteps.slice(0, 9).map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === tutorialStep ? 'bg-blue-400' : idx < tutorialStep ? 'bg-blue-600' : 'bg-blue-800'
                  }`}
                />
              ))}
            </div>
          </div>
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
