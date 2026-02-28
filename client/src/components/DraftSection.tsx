import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Shuffle, ShoppingCart, CreditCard, Search, Plus, Minus, CheckCircle, AlertCircle, Coins, Users, Swords, Zap, Package, Check, Trophy } from 'lucide-react';

interface DraftSectionProps {
  onBack: () => void;
  playerName: string;
}

interface DraftCard {
  id: string;
  deckType: 'personaggi' | 'mosse' | 'bonus';
  name: string;
  imageUrl: string;
  pti?: number;
  stars?: number;
  draftCost: number;
}

interface DraftStatus {
  freeCredits: number;
  paidCredits: number;
  totalCredits: number;
  puntiRankiard: number;
  deck: {
    personaggiCount: number;
    mosseCount: number;
    bonusCount: number;
    isComplete: boolean;
    totalCostSpent: number;
    savedAt: string;
  } | null;
}

interface CreditPurchaseHistory {
  id: number;
  packageId: string;
  creditsAmount: number;
  priceEur: number;
  status: string;
  createdAt: string;
}

const CREDIT_PACKAGES = [
  { id: '100',  credits: 100,  priceEur: 1.00, label: '100 crediti', popular: false },
  { id: '500',  credits: 500,  priceEur: 5.00, label: '500 crediti', popular: false },
  { id: '1000', credits: 1000, priceEur: 10.00, label: '1.000 crediti', popular: false },
  { id: '1500', credits: 1500, priceEur: 12.00, label: '1.500 crediti', popular: true },
  { id: '2000', credits: 2000, priceEur: 15.00, label: '2.000 crediti', popular: false },
  { id: '5000', credits: 5000, priceEur: 40.00, label: '5.000 crediti', popular: false },
];

const DECK_TYPES = [
  { key: 'personaggi' as const, label: 'Personaggi', icon: Users, color: 'from-purple-500 to-purple-700', target: 33 },
  { key: 'mosse' as const, label: 'Mosse', icon: Swords, color: 'from-red-500 to-red-700', target: 33 },
  { key: 'bonus' as const, label: 'Bonus', icon: Zap, color: 'from-cyan-500 to-cyan-700', target: 33 },
];

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function DraftSection({ onBack, playerName }: DraftSectionProps) {
  const [activeTab, setActiveTab] = useState<'deck' | 'shop' | 'credits'>('deck');
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [allCards, setAllCards] = useState<DraftCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<{ personaggi: string[]; mosse: string[]; bonus: string[] }>({ personaggi: [], mosse: [], bonus: [] });
  const [shopFilter, setShopFilter] = useState<'all' | 'personaggi' | 'mosse' | 'bonus'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [purchaseNote, setPurchaseNote] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMsg, setPurchaseMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [purchases, setPurchases] = useState<CreditPurchaseHistory[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, deckRes, cardsRes] = await Promise.all([
        fetch('/api/draft/status', { headers: getAuthHeaders() }),
        fetch('/api/draft/deck', { headers: getAuthHeaders() }),
        fetch('/api/draft/cards'),
      ]);
      if (statusRes.ok) {
        const s = await statusRes.json();
        setStatus(s);
      }
      if (deckRes.ok) {
        const d = await deckRes.json();
        setSelectedCards({
          personaggi: d.personaggiCards || [],
          mosse: d.mosseCards || [],
          bonus: d.bonusCards || [],
        });
      }
      if (cardsRes.ok) {
        const cards = await cardsRes.json();
        setAllCards(Array.isArray(cards) ? cards : []);
      }
    } catch (e) {
      console.error('Failed to load draft data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPurchaseHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/my-purchases', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPurchases(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchAll();
    fetchPurchaseHistory();
  }, [fetchAll, fetchPurchaseHistory]);

  const totalCostSelected = useCallback(() => {
    const allSelected = [...selectedCards.personaggi, ...selectedCards.mosse, ...selectedCards.bonus];
    return allSelected.reduce((sum, id) => {
      const card = allCards.find(c => c.id === id);
      return sum + (card?.draftCost || 0);
    }, 0);
  }, [selectedCards, allCards]);

  const availableCredits = status ? status.totalCredits + status.puntiRankiard : 0;
  const totalCost = totalCostSelected();
  const canAfford = totalCost <= availableCredits;
  const isComplete = selectedCards.personaggi.length === 33 && selectedCards.mosse.length === 33 && selectedCards.bonus.length === 33;

  const toggleCard = (card: DraftCard) => {
    const dt = card.deckType;
    setSelectedCards(prev => {
      const current = prev[dt];
      if (current.includes(card.id)) {
        return { ...prev, [dt]: current.filter(id => id !== card.id) };
      }
      if (current.length >= 33) {
        setSaveMessage({ type: 'error', text: `Hai già 33 ${dt} nel mazzo. Rimuovine una prima.` });
        setTimeout(() => setSaveMessage(null), 3000);
        return prev;
      }
      return { ...prev, [dt]: [...current, card.id] };
    });
  };

  const removeCard = (cardId: string, deckType: 'personaggi' | 'mosse' | 'bonus') => {
    setSelectedCards(prev => ({ ...prev, [deckType]: prev[deckType].filter(id => id !== cardId) }));
  };

  const handleSave = async () => {
    if (!isComplete) {
      setSaveMessage({ type: 'error', text: 'Il mazzo deve avere esattamente 33 personaggi, 33 mosse e 33 bonus.' });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }
    if (!canAfford) {
      setSaveMessage({ type: 'error', text: `Crediti insufficienti. Ne servono ${totalCost.toLocaleString()}, ne hai ${availableCredits.toLocaleString()}.` });
      setTimeout(() => setSaveMessage(null), 5000);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/draft/deck', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ personaggiCards: selectedCards.personaggi, mosseCards: selectedCards.mosse, bonusCards: selectedCards.bonus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveMessage({ type: 'success', text: 'Mazzo salvato! Puoi usarlo nelle partite in modalità Draft.' });
        await fetchAll();
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Errore nel salvataggio.' });
      }
    } catch (e) {
      setSaveMessage({ type: 'error', text: 'Errore di connessione.' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 6000);
    }
  };

  const handlePurchaseRequest = async () => {
    if (!selectedPackage) return;
    setPurchaseLoading(true);
    try {
      const res = await fetch('/api/draft/purchase-credits', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ packageId: selectedPackage, paymentNote: purchaseNote }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPurchaseMsg({ type: 'success', text: 'Richiesta inviata. I crediti verranno aggiunti dopo la verifica del pagamento.' });
        setSelectedPackage(null);
        setPurchaseNote('');
        fetchPurchaseHistory();
      } else {
        setPurchaseMsg({ type: 'error', text: data.error || 'Errore.' });
      }
    } catch (e) {
      setPurchaseMsg({ type: 'error', text: 'Errore di connessione.' });
    } finally {
      setPurchaseLoading(false);
      setTimeout(() => setPurchaseMsg(null), 8000);
    }
  };

  const filteredCards = allCards.filter(card => {
    if (shopFilter !== 'all' && card.deckType !== shopFilter) return false;
    if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getCardById = (id: string) => allCards.find(c => c.id === id);

  return (
    <div className="min-h-screen bg-arena-deep flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 10%, rgba(88, 28, 135, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30, 58, 138, 0.3) 0%, transparent 55%), linear-gradient(180deg, #03050d 0%, #070b1a 30%, #0a1028 60%, #060918 100%)'
      }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, #0d9488, transparent 65%)', opacity: 0.15, top: '5%', left: '5%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, #7c3aed, transparent 65%)', opacity: 0.12, bottom: '10%', right: '5%' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium text-sm">Home</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
            <Shuffle className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-white font-black text-lg tracking-wide">Modalità Draft</h1>
        </div>
        {status && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-teal-900/40 border border-teal-500/30 rounded-lg px-2.5 py-1.5">
              <Coins className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-teal-300 font-bold text-sm">{status.totalCredits.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-900/40 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-bold text-sm">{status.puntiRankiard.toLocaleString()} PR</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex border-b border-white/10 bg-black/10 flex-shrink-0">
        {([
          { key: 'deck', label: 'Il mio mazzo', icon: Package },
          { key: 'shop', label: 'Negozio carte', icon: ShoppingCart },
          { key: 'credits', label: 'Acquista crediti', icon: CreditCard },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all ${
              activeTab === key
                ? 'text-teal-300 border-b-2 border-teal-400 bg-teal-500/10'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white/50 text-sm">Caricamento...</p>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 overflow-y-auto p-4">

          {/* ===== TAB: IL MIO MAZZO ===== */}
          {activeTab === 'deck' && (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Progress cards */}
              <div className="grid grid-cols-3 gap-3">
                {DECK_TYPES.map(({ key, label, icon: Icon, color, target }) => {
                  const count = selectedCards[key].length;
                  const done = count === target;
                  return (
                    <div key={key} className={`rounded-xl border p-3 ${done ? 'border-green-500/50 bg-green-900/20' : 'border-white/10 bg-white/5'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-white/80 text-xs font-semibold truncate">{label}</span>
                        {done && <Check className="w-3.5 h-3.5 text-green-400 ml-auto flex-shrink-0" />}
                      </div>
                      <div className={`text-xl font-black ${done ? 'text-green-400' : count > 0 ? 'text-white' : 'text-white/30'}`}>
                        {count}<span className="text-xs text-white/40">/{target}</span>
                      </div>
                      <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`} style={{ width: `${(count / target) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cost bar */}
              <div className="flex items-center justify-between bg-black/30 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-teal-400" />
                  <span className="text-white/70">Costo mazzo:</span>
                  <span className={`font-bold ${canAfford ? 'text-teal-300' : 'text-red-400'}`}>{totalCost.toLocaleString()}</span>
                  <span className="text-white/40">/ {availableCredits.toLocaleString()} disponibili</span>
                </div>
                {!canAfford && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Crediti insufficienti</span>}
              </div>

              {/* Save message */}
              {saveMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${saveMessage.type === 'success' ? 'bg-green-900/40 border border-green-500/50 text-green-300' : 'bg-red-900/40 border border-red-500/50 text-red-300'}`}>
                  {saveMessage.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {saveMessage.text}
                </div>
              )}

              {/* Deck lists */}
              {DECK_TYPES.map(({ key, label, icon: Icon, color }) => {
                const deckCards = selectedCards[key].map(id => getCardById(id)).filter(Boolean) as DraftCard[];
                return (
                  <div key={key} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${color} bg-opacity-20 border-b border-white/10`}>
                      <Icon className="w-4 h-4 text-white" />
                      <span className="text-white font-bold text-sm">{label}</span>
                      <span className="text-white/60 text-xs ml-auto">{deckCards.length}/33</span>
                    </div>
                    {deckCards.length === 0 ? (
                      <div className="py-5 text-center text-white/30 text-sm">
                        Nessuna carta — vai al <button onClick={() => setActiveTab('shop')} className="text-teal-400 underline">Negozio</button> per aggiungerne
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-3">
                        {deckCards.map(card => (
                          <div key={card.id} className="relative group rounded-lg overflow-hidden bg-black/30 border border-white/10 hover:border-white/30 transition-all cursor-pointer" onClick={() => removeCard(card.id, key)}>
                            <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-red-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="flex flex-col items-center gap-1">
                                <Minus className="w-5 h-5 text-white" />
                                <span className="text-white text-xs font-bold">Rimuovi</span>
                              </div>
                            </div>
                            {card.draftCost > 0 && (
                              <div className="absolute top-1 right-1 bg-teal-900/90 text-teal-300 text-xs px-1 py-0.5 rounded font-bold">
                                {card.draftCost}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Save button */}
              <div className="pb-6">
                <button
                  onClick={handleSave}
                  disabled={saving || !isComplete || !canAfford}
                  className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                    isComplete && canAfford
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg shadow-teal-500/30'
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvataggio...</>
                  ) : isComplete ? (
                    <><CheckCircle className="w-5 h-5" />Salva mazzo</>
                  ) : (
                    <><Package className="w-5 h-5" />Completa il mazzo (33 per tipo)</>
                  )}
                </button>
                {!isComplete && (
                  <p className="text-white/40 text-xs text-center mt-2">
                    Mancano: {Math.max(0, 33 - selectedCards.personaggi.length)}P · {Math.max(0, 33 - selectedCards.mosse.length)}M · {Math.max(0, 33 - selectedCards.bonus.length)}B
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ===== TAB: NEGOZIO CARTE ===== */}
          {activeTab === 'shop' && (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cerca carta..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-teal-400/50 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'personaggi', 'mosse', 'bonus'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setShopFilter(f)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${shopFilter === f ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                    >
                      {f === 'all' ? 'Tutte' : f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-white/60 bg-black/20 rounded-lg px-3 py-2">
                <Coins className="w-4 h-4 text-teal-400" />
                <span>Budget: <strong className="text-teal-300">{availableCredits.toLocaleString()}</strong> · Speso: <strong className={canAfford ? 'text-teal-300' : 'text-red-400'}>{totalCost.toLocaleString()}</strong></span>
                <span className="ml-auto text-xs">{filteredCards.length} carte</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredCards.map(card => {
                  const selected = selectedCards[card.deckType].includes(card.id);
                  const count = selectedCards[card.deckType].length;
                  const full = count >= 33 && !selected;
                  return (
                    <div
                      key={card.id}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        selected ? 'border-teal-400 shadow-lg shadow-teal-500/30 scale-[1.02]' :
                        full ? 'border-white/10 opacity-40 cursor-not-allowed' :
                        'border-white/10 hover:border-white/40 hover:scale-[1.02]'
                      }`}
                      onClick={() => !full && toggleCard(card)}
                    >
                      <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                          card.deckType === 'personaggi' ? 'bg-purple-700/90 text-purple-200' :
                          card.deckType === 'mosse' ? 'bg-red-700/90 text-red-200' :
                          'bg-cyan-700/90 text-cyan-200'
                        }`}>
                          {card.deckType[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute top-1.5 right-1.5">
                        {card.draftCost > 0 ? (
                          <span className="flex items-center gap-0.5 bg-teal-900/90 text-teal-300 text-xs px-1.5 py-0.5 rounded font-bold">
                            <Coins className="w-2.5 h-2.5" />{card.draftCost}
                          </span>
                        ) : (
                          <span className="bg-green-900/90 text-green-300 text-xs px-1.5 py-0.5 rounded font-bold">FREE</span>
                        )}
                      </div>
                      {selected && (
                        <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                          <CheckCircle className="w-8 h-8 text-teal-300 drop-shadow-lg" />
                        </div>
                      )}
                      <div className="bg-black/70 p-1.5">
                        <p className="text-white text-xs font-medium truncate">{card.name}</p>
                        {card.pti != null && <p className="text-white/50 text-xs">PTI: {card.pti}{card.stars ? ` · ★${card.stars}` : ''}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredCards.length === 0 && (
                <div className="text-center py-10 text-white/40">Nessuna carta trovata.</div>
              )}
            </div>
          )}

          {/* ===== TAB: ACQUISTA CREDITI ===== */}
          {activeTab === 'credits' && (
            <div className="max-w-3xl mx-auto space-y-5">
              {status && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Crediti gratuiti', value: status.freeCredits, color: 'teal' },
                    { label: 'Crediti acquistati', value: status.paidCredits, color: 'blue' },
                    { label: 'Punti Rankiard', value: status.puntiRankiard, color: 'amber' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-${color}-900/30 border border-${color}-500/30 rounded-xl p-4 text-center`}>
                      <div className={`text-${color}-400 text-xs mb-1`}>{label}</div>
                      <div className={`text-${color}-300 text-2xl font-black`}>{value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200 leading-relaxed">
                <strong className="text-blue-300">Come funziona:</strong> Seleziona un pacchetto, effettua il pagamento, poi invia la tua richiesta con il riferimento di pagamento. I crediti vengono aggiunti al tuo account dopo la verifica (solitamente entro 24 ore).
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CREDIT_PACKAGES.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(prev => prev === pkg.id ? null : pkg.id)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      selectedPackage === pkg.id ? 'border-teal-400 bg-teal-900/30' : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                        PIU' POPOLARE
                      </div>
                    )}
                    <div className="flex items-center gap-1 mb-1">
                      <Coins className="w-4 h-4 text-teal-400" />
                      <span className="text-teal-300 font-black text-sm">{pkg.label}</span>
                    </div>
                    <div className="text-white text-xl font-black">€{pkg.priceEur.toFixed(2)}</div>
                    {selectedPackage === pkg.id && <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-teal-400" />}
                  </button>
                ))}
              </div>

              {selectedPackage && (() => {
                const pkg = CREDIT_PACKAGES.find(p => p.id === selectedPackage)!;
                return (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <h4 className="text-white font-bold">Richiesta per {pkg.label} — €{pkg.priceEur.toFixed(2)}</h4>
                    <div>
                      <label className="text-white/80 text-sm font-medium block mb-1.5">Riferimento di pagamento (opzionale)</label>
                      <input
                        type="text"
                        value={purchaseNote}
                        onChange={e => setPurchaseNote(e.target.value)}
                        placeholder="Es: numero transazione, data, metodo usato..."
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-teal-400/50 text-sm"
                      />
                    </div>
                    <button
                      onClick={handlePurchaseRequest}
                      disabled={purchaseLoading}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold py-3 rounded-xl transition-all"
                    >
                      {purchaseLoading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Invio...</>
                      ) : (
                        <><CreditCard className="w-4 h-4" />Invia richiesta</>
                      )}
                    </button>
                  </div>
                );
              })()}

              {purchaseMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${purchaseMsg.type === 'success' ? 'bg-green-900/40 border border-green-500/50 text-green-300' : 'bg-red-900/40 border border-red-500/50 text-red-300'}`}>
                  {purchaseMsg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {purchaseMsg.text}
                </div>
              )}

              {purchases.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-white font-bold text-sm">Storico acquisti</h3>
                  {purchases.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
                      <Coins className="w-4 h-4 text-teal-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{p.creditsAmount.toLocaleString()} crediti</div>
                        <div className="text-white/40 text-xs">{new Date(p.createdAt).toLocaleDateString('it-IT')}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        p.status === 'approved' ? 'bg-green-900/60 text-green-300' :
                        p.status === 'rejected' ? 'bg-red-900/60 text-red-300' :
                        'bg-amber-900/60 text-amber-300'
                      }`}>
                        {p.status === 'approved' ? 'Approvato' : p.status === 'rejected' ? 'Rifiutato' : 'In attesa'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
