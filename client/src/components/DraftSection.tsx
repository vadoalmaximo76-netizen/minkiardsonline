import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Shuffle, ShoppingCart, CreditCard, Search, Plus, Minus, CheckCircle, AlertCircle, Coins, Users, Swords, Zap, Package, Check, Trophy, X, SortAsc, SortDesc, Sparkles, Trash2, Filter, Gift, Star, Lock, ChevronDown, ChevronUp, Clock, Target, Flame, BookOpen, Save, RotateCcw, Calendar, Ticket, Store } from 'lucide-react';
import { PackOpeningAnimation, PackType, RevealedCard } from './PackOpeningAnimation';
import { SeasonPass } from './SeasonPass';
import { Marketplace } from './Marketplace';

interface DraftSectionProps {
  onBack: () => void;
  playerName: string;
  userId?: number;
}

interface DraftCard {
  id: string;
  deckType: 'personaggi' | 'mosse' | 'bonus';
  name: string;
  imageUrl: string;
  pti?: number;
  stars?: number;
  draftCost: number;
  userOwns?: boolean;
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

interface DailyCardStatus {
  available: boolean;
  nextClaimAt: string | null;
  lastClaimAt: string | null;
}

interface PackHistoryEntry {
  id: number;
  packId: string;
  creditsSpent: number;
  cardsObtained: Array<{ cardId: string; rarity: string; name: string; deckType: string }>;
  duplicatesCredits: number;
  openedAt: string;
}

interface WeeklyOffer {
  cardId: string;
  deckType: string;
  name: string;
  frontImage: string;
  draftCost: number;
  rarity: string;
  originalCost: number;
  discountedCost: number;
}

interface DraftPreset {
  id: number;
  presetName: string;
  personaggiCards: string[];
  mosseCards: string[];
  bonusCards: string[];
  createdAt: string;
}

interface DraftMission {
  code: string;
  name: string;
  description: string;
  requirement: number;
  rewardCredits: number;
  icon: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
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
  { key: 'personaggi' as const, label: 'Personaggi', icon: Users, color: 'from-purple-500 to-purple-700', accent: 'purple', target: 33 },
  { key: 'mosse' as const, label: 'Mosse', icon: Swords, color: 'from-red-500 to-red-700', accent: 'red', target: 33 },
  { key: 'bonus' as const, label: 'Bonus', icon: Zap, color: 'from-cyan-500 to-cyan-700', accent: 'cyan', target: 33 },
];

type SortMode = 'name-asc' | 'name-desc' | 'cost-asc' | 'cost-desc' | 'free-first';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function DraftSection({ onBack, playerName, userId }: DraftSectionProps) {
  const [activeTab, setActiveTab] = useState<'deck' | 'shop' | 'credits' | 'packs' | 'collection' | 'pass' | 'marketplace'>('deck');
  const [status, setStatus] = useState<DraftStatus | null>(null);
  const [allCards, setAllCards] = useState<DraftCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<{ personaggi: string[]; mosse: string[]; bonus: string[] }>({ personaggi: [], mosse: [], bonus: [] });
  const [shopFilter, setShopFilter] = useState<'all' | 'personaggi' | 'mosse' | 'bonus' | 'offers'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('free-first');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [purchaseNote, setPurchaseNote] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseMsg, setPurchaseMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [purchases, setPurchases] = useState<CreditPurchaseHistory[]>([]);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [availablePacks, setAvailablePacks] = useState<PackType[]>([]);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());
  const [openingPackId, setOpeningPackId] = useState<string | null>(null);
  const [packAnimation, setPackAnimation] = useState<{ pack: PackType; cards: RevealedCard[] } | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  // Collection tab
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'personaggi' | 'mosse' | 'bonus'>('all');
  const [collectionRarityFilter, setCollectionRarityFilter] = useState<'all' | 'comune' | 'rara' | 'epica' | 'leggendaria'>('all');
  const [ownedCardDetails, setOwnedCardDetails] = useState<Array<{ cardId: string; rarity: string; deckType: string }>>([]);
  // Daily card
  const [dailyCardStatus, setDailyCardStatus] = useState<DailyCardStatus | null>(null);
  const [dailyCountdown, setDailyCountdown] = useState('');
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [dailyResult, setDailyResult] = useState<(RevealedCard & { rarity: string }) | null>(null);
  // Pack history
  const [packHistory, setPackHistory] = useState<PackHistoryEntry[]>([]);
  const [showPackHistory, setShowPackHistory] = useState(false);
  // Weekly offers
  const [weeklyOffers, setWeeklyOffers] = useState<WeeklyOffer[]>([]);
  const [daysUntilReset, setDaysUntilReset] = useState(0);
  // Presets
  const [presets, setPresets] = useState<DraftPreset[]>([]);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetMsg, setPresetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Missions
  const [missions, setMissions] = useState<DraftMission[]>([]);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCollection = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/collection', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setOwnedCardIds(new Set(arr.map((c: any) => c.cardId)));
        setOwnedCardDetails(arr.map((c: any) => ({ cardId: c.cardId, rarity: c.rarity || 'comune', deckType: c.deckType || '' })));
      }
    } catch (e) {}
  }, []);

  const fetchDailyCard = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/daily-card', { headers: getAuthHeaders() });
      if (res.ok) setDailyCardStatus(await res.json());
    } catch (e) {}
  }, []);

  const fetchPackHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/pack-history', { headers: getAuthHeaders() });
      if (res.ok) setPackHistory(await res.json());
    } catch (e) {}
  }, []);

  const fetchWeeklyOffers = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/weekly-offers');
      if (res.ok) {
        const data = await res.json();
        setWeeklyOffers(data.offers || []);
        setDaysUntilReset(data.daysUntilReset || 0);
      }
    } catch (e) {}
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/deck/presets', { headers: getAuthHeaders() });
      if (res.ok) setPresets(await res.json());
    } catch (e) {}
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/missions', { headers: getAuthHeaders() });
      if (res.ok) setMissions(await res.json());
    } catch (e) {}
  }, []);

  const fetchPacks = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/packs', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.packs) setAvailablePacks(data.packs);
      }
    } catch (e) {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, deckRes, cardsRes] = await Promise.all([
        fetch('/api/draft/status', { headers: getAuthHeaders() }),
        fetch('/api/draft/deck', { headers: { ...getAuthHeaders(), 'Cache-Control': 'no-cache' }, cache: 'no-store' }),
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
    fetchCollection();
    fetchPacks();
    fetchDailyCard();
    fetchPackHistory();
    fetchWeeklyOffers();
    fetchPresets();
    fetchMissions();
  }, [fetchAll, fetchPurchaseHistory, fetchCollection, fetchPacks, fetchDailyCard, fetchPackHistory, fetchWeeklyOffers, fetchPresets, fetchMissions]);

  // Countdown timer for daily card
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const tick = () => {
      if (!dailyCardStatus?.nextClaimAt) { setDailyCountdown(''); return; }
      const diff = new Date(dailyCardStatus.nextClaimAt).getTime() - Date.now();
      if (diff <= 0) { setDailyCountdown(''); fetchDailyCard(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDailyCountdown(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [dailyCardStatus, fetchDailyCard]);

  const openPack = async (pack: PackType) => {
    setOpeningPackId(pack.id);
    setPackError(null);
    try {
      const res = await fetch('/api/draft/open-pack', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPackAnimation({ pack, cards: data.cards as RevealedCard[] });
      } else {
        setPackError(data.error || 'Errore nell\'apertura del pacchetto');
      }
    } catch (e: any) {
      setPackError(e.message || 'Errore di rete');
    } finally {
      setOpeningPackId(null);
    }
  };

  const fetchDeck = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/deck', {
        headers: { ...getAuthHeaders(), 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedCards({
          personaggi: d.personaggiCards || [],
          mosse: d.mosseCards || [],
          bonus: d.bonusCards || [],
        });
      }
    } catch {}
  }, []);

  const handleAnimationClose = () => {
    setPackAnimation(null);
    fetchAll();
    fetchCollection();
    fetchPacks();
    fetchPackHistory();
    fetchMissions();
  };

  const claimDailyCard = async () => {
    setClaimingDaily(true);
    setDailyResult(null);
    try {
      const res = await fetch('/api/draft/claim-daily-card', { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setDailyResult(data.card);
        setDailyCardStatus({ available: false, nextClaimAt: data.nextClaimAt, lastClaimAt: new Date().toISOString() });
        fetchCollection();
        fetchMissions();
      }
    } catch (e) {}
    setClaimingDaily(false);
  };

  const savePreset = async () => {
    if (!presetNameInput.trim()) return;
    setPresetLoading(true);
    try {
      const res = await fetch('/api/draft/deck/presets', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ presetName: presetNameInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPresetMsg({ type: 'success', text: '✓ Preset salvato!' });
        setShowPresetDialog(false);
        setPresetNameInput('');
        fetchPresets();
      } else {
        setPresetMsg({ type: 'error', text: data.error || 'Errore salvataggio' });
      }
    } catch (e) {
      setPresetMsg({ type: 'error', text: 'Errore di rete' });
    }
    setPresetLoading(false);
    setTimeout(() => setPresetMsg(null), 4000);
  };

  const deletePreset = async (id: number) => {
    try {
      const res = await fetch(`/api/draft/deck/presets/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { fetchPresets(); setPresetMsg({ type: 'success', text: '✓ Preset eliminato' }); setTimeout(() => setPresetMsg(null), 3000); }
    } catch (e) {}
  };

  const loadPreset = async (id: number) => {
    try {
      const res = await fetch(`/api/draft/deck/load-preset/${id}`, { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedCards({
          personaggi: data.personaggiCards || [],
          mosse: data.mosseCards || [],
          bonus: data.bonusCards || [],
        });
        setPresetMsg({ type: 'success', text: '✓ Preset caricato nel mazzo!' });
        setTimeout(() => setPresetMsg(null), 4000);
      }
    } catch (e) {}
  };

  const claimMission = async (code: string) => {
    setClaimingMission(code);
    try {
      const res = await fetch(`/api/draft/missions/claim/${code}`, { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchMissions();
        fetchAll();
      }
    } catch (e) {}
    setClaimingMission(null);
  };

  const buyWeeklyOffer = (offer: WeeklyOffer) => {
    const card: DraftCard | undefined = allCards.find(c => c.id === offer.cardId);
    if (card) toggleCard({ ...card, draftCost: offer.discountedCost });
  };

  const totalCostSelected = useCallback(() => {
    const allSelected = [...selectedCards.personaggi, ...selectedCards.mosse, ...selectedCards.bonus];
    return allSelected.reduce((sum, id) => {
      if (ownedCardIds.has(id)) return sum;
      const card = allCards.find(c => c.id === id);
      return sum + (card?.draftCost || 0);
    }, 0);
  }, [selectedCards, allCards, ownedCardIds]);

  const availableCredits = status ? status.totalCredits + status.puntiRankiard : 0;
  const totalCost = totalCostSelected();
  const canAfford = totalCost <= availableCredits;
  const isComplete = selectedCards.personaggi.length >= 33 && selectedCards.mosse.length >= 33 && selectedCards.bonus.length >= 33;
  const totalSelected = selectedCards.personaggi.length + selectedCards.mosse.length + selectedCards.bonus.length;

  const filteredAndSortedCards = useMemo(() => {
    let cards = allCards.filter(card => {
      if (shopFilter === 'offers') return weeklyOffers.some(o => o.cardId === card.id);
      if (shopFilter !== 'all' && card.deckType !== shopFilter) return false;
      if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });

    switch (sortMode) {
      case 'name-asc': cards = [...cards].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': cards = [...cards].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'cost-asc': cards = [...cards].sort((a, b) => a.draftCost - b.draftCost); break;
      case 'cost-desc': cards = [...cards].sort((a, b) => b.draftCost - a.draftCost); break;
      case 'free-first': cards = [...cards].sort((a, b) => a.draftCost - b.draftCost || a.name.localeCompare(b.name)); break;
    }
    return cards;
  }, [allCards, shopFilter, searchQuery, sortMode]);

  const deckTypeCardCounts = useMemo(() => ({
    personaggi: allCards.filter(c => c.deckType === 'personaggi').length,
    mosse: allCards.filter(c => c.deckType === 'mosse').length,
    bonus: allCards.filter(c => c.deckType === 'bonus').length,
  }), [allCards]);

  const toggleCard = (card: DraftCard) => {
    const dt = card.deckType;
    setSelectedCards(prev => {
      const current = prev[dt];
      if (current.includes(card.id)) {
        return { ...prev, [dt]: current.filter(id => id !== card.id) };
      }
      return { ...prev, [dt]: [...current, card.id] };
    });
  };

  const removeCard = (cardId: string, deckType: 'personaggi' | 'mosse' | 'bonus') => {
    setSelectedCards(prev => ({ ...prev, [deckType]: prev[deckType].filter(id => id !== cardId) }));
  };

  const clearDeckType = (deckType: 'personaggi' | 'mosse' | 'bonus') => {
    setSelectedCards(prev => ({ ...prev, [deckType]: [] }));
  };

  // Fill remaining slots with cheapest free cards (owned cards get priority)
  const fillFree = (deckType?: 'personaggi' | 'mosse' | 'bonus') => {
    const types = deckType ? [deckType] : (['personaggi', 'mosse', 'bonus'] as const);
    setSelectedCards(prev => {
      const next = { ...prev };
      for (const dt of types) {
        const current = new Set(next[dt]);
        const needed = 33 - current.size;
        if (needed <= 0) continue;
        const candidates = allCards
          .filter(c => c.deckType === dt && !current.has(c.id))
          .sort((a, b) => {
            const aOwned = ownedCardIds.has(a.id) ? -1 : 0;
            const bOwned = ownedCardIds.has(b.id) ? -1 : 0;
            if (aOwned !== bOwned) return aOwned - bOwned;
            return a.draftCost - b.draftCost || a.name.localeCompare(b.name);
          });
        const picked = candidates.slice(0, needed).map(c => c.id);
        next[dt] = [...current, ...picked];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!isComplete) {
      setSaveMessage({ type: 'error', text: 'Il mazzo deve avere almeno 33 personaggi, 33 mosse e 33 bonus.' });
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
        setSaveMessage({ type: 'success', text: '✓ Mazzo salvato! Puoi usarlo nelle partite in modalità Draft.' });
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
        setPurchaseMsg({ type: 'success', text: 'Richiesta inviata! I crediti verranno aggiunti dopo la verifica del pagamento.' });
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

  const getCardById = (id: string) => allCards.find(c => c.id === id);

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'free-first', label: 'Gratis prima' },
    { value: 'cost-asc', label: 'Costo ↑' },
    { value: 'cost-desc', label: 'Costo ↓' },
    { value: 'name-asc', label: 'Nome A-Z' },
    { value: 'name-desc', label: 'Nome Z-A' },
  ];

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
        {status ? (
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
        ) : <div className="w-24" />}
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex border-b border-white/10 bg-black/10 flex-shrink-0 overflow-x-auto">
        {([
          { key: 'deck', label: 'Mazzo', icon: Package, badge: totalSelected > 0 ? `${totalSelected}/99` : null },
          { key: 'shop', label: 'Negozio', icon: ShoppingCart, badge: null },
          { key: 'packs', label: 'Pacchetti', icon: Gift, badge: dailyCardStatus?.available ? '!' : null },
          { key: 'collection', label: 'Collezione', icon: BookOpen, badge: ownedCardIds.size > 0 ? `${ownedCardIds.size}` : null },
          { key: 'credits', label: 'Crediti', icon: CreditCard, badge: null },
          { key: 'pass', label: 'Pass', icon: Ticket, badge: null },
          { key: 'marketplace', label: 'Mercato', icon: Store, badge: null },
        ] as const).map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 text-xs sm:text-sm font-semibold transition-all relative ${
              activeTab === key
                ? 'text-teal-300 border-b-2 border-teal-400 bg-teal-500/10'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            {badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${badge === '!' ? 'bg-amber-500 text-black animate-pulse' : activeTab === key ? 'bg-teal-500/30 text-teal-300' : 'bg-white/10 text-white/40'}`}>
                {badge}
              </span>
            )}
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
                      <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-300`} style={{ width: `${(count / target) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick fill + cost bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => fillFree()}
                  disabled={isComplete}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600/40 to-teal-600/40 hover:from-purple-600/60 hover:to-teal-600/60 border border-purple-500/30 hover:border-purple-500/50 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  Riempi con carte gratuite
                </button>
                <div className="flex-1 flex items-center justify-between bg-black/30 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-teal-400" />
                    <span className="text-white/70">Costo:</span>
                    <span className={`font-bold ${canAfford ? 'text-teal-300' : 'text-red-400'}`}>{totalCost.toLocaleString()}</span>
                    <span className="text-white/40">/ {availableCredits.toLocaleString()}</span>
                  </div>
                  {!canAfford && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Crediti insufficienti</span>}
                </div>
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
                const missing = 33 - deckCards.length;
                return (
                  <div key={key} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${color} bg-opacity-20 border-b border-white/10`}>
                      <Icon className="w-4 h-4 text-white" />
                      <span className="text-white font-bold text-sm">{label}</span>
                      <span className={`text-xs ml-1 font-semibold ${deckCards.length >= 33 ? 'text-green-300' : 'text-white/50'}`}>{deckCards.length} {deckCards.length < 33 ? `(min 33)` : '✓'}</span>
                      <div className="ml-auto flex items-center gap-2">
                        {missing > 0 && (
                          <button
                            onClick={() => fillFree(key)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-white/10 hover:bg-purple-500/30 rounded-lg text-white/60 hover:text-purple-300 transition-all"
                            title={`Aggiungi ${missing} carte gratis`}
                          >
                            <Sparkles className="w-3 h-3" />+{missing}
                          </button>
                        )}
                        {deckCards.length > 0 && (
                          <button
                            onClick={() => clearDeckType(key)}
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-white/10 hover:bg-red-500/30 rounded-lg text-white/60 hover:text-red-300 transition-all"
                            title="Svuota questo tipo"
                          >
                            <Trash2 className="w-3 h-3" />Svuota
                          </button>
                        )}
                      </div>
                    </div>
                    {deckCards.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-white/30 text-sm mb-2">Nessuna carta selezionata</p>
                        <button onClick={() => { setActiveTab('shop'); setShopFilter(key); }} className="text-teal-400 text-sm underline hover:text-teal-300">
                          Vai al negozio →
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11 gap-1.5 p-3">
                        {deckCards.map(card => (
                          <div
                            key={card.id}
                            className="relative group rounded-lg overflow-hidden bg-black/30 border border-white/10 hover:border-red-400/50 transition-all cursor-pointer"
                            onClick={() => removeCard(card.id, key)}
                            title={`${card.name}${card.draftCost > 0 ? ` — ${card.draftCost} crediti` : ' — Gratuita'}\nClicca per rimuovere`}
                          >
                            <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-red-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Minus className="w-5 h-5 text-white drop-shadow" />
                            </div>
                            {card.draftCost > 0 && (
                              <div className="absolute top-0.5 right-0.5 bg-teal-900/90 text-teal-300 text-[10px] px-1 py-0.5 rounded font-bold leading-none">
                                {card.draftCost}
                              </div>
                            )}
                          </div>
                        ))}
                        {/* Empty slot placeholders */}
                        {missing > 0 && Array.from({ length: Math.min(missing, 5) }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            onClick={() => { setActiveTab('shop'); setShopFilter(key); }}
                            className="rounded-lg border border-dashed border-white/15 bg-white/3 aspect-[2/3] flex items-center justify-center cursor-pointer hover:border-teal-400/40 transition-all group"
                            title="Aggiungi carta"
                          >
                            <Plus className="w-3 h-3 text-white/20 group-hover:text-teal-400/60 transition-colors" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Save button */}
              <div>
                <button
                  onClick={handleSave}
                  disabled={saving || !isComplete || !canAfford}
                  className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                    isComplete && canAfford
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white shadow-lg shadow-teal-500/30 active:scale-[0.99]'
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
                    Mancano: {Math.max(0, 33 - selectedCards.personaggi.length)} personaggi · {Math.max(0, 33 - selectedCards.mosse.length)} mosse · {Math.max(0, 33 - selectedCards.bonus.length)} bonus
                  </p>
                )}
              </div>

              {/* === Missioni Draft === */}
              {missions.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span className="text-white/80 font-bold text-sm">Missioni Draft</span>
                    <span className="text-white/40 text-xs ml-1">
                      {missions.filter(m => m.claimed).length}/{missions.length} completate
                    </span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {missions.map(m => (
                      <div key={m.code} className={`px-4 py-3 flex items-center gap-3 ${m.claimed ? 'opacity-50' : ''}`}>
                        <div className="text-xl flex-shrink-0">{m.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/90 text-sm font-semibold">{m.name}</span>
                            {m.claimed && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                          </div>
                          <p className="text-white/50 text-xs">{m.description}</p>
                          <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${m.completed ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-purple-500 to-teal-500'}`}
                              style={{ width: `${Math.min(100, (m.progress / m.requirement) * 100)}%` }}
                            />
                          </div>
                          <div className="text-white/40 text-[10px] mt-0.5">{m.progress}/{m.requirement}</div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-teal-400 text-xs font-bold mb-1">+{m.rewardCredits} cr</div>
                          {m.completed && !m.claimed && (
                            <button
                              onClick={() => claimMission(m.code)}
                              disabled={claimingMission === m.code}
                              className="text-xs px-2.5 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-lg transition-all disabled:opacity-50"
                            >
                              {claimingMission === m.code ? '...' : 'Riscuoti'}
                            </button>
                          )}
                          {m.claimed && <span className="text-green-400 text-xs">✓ Riscossa</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === Preset Mazzo === */}
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden pb-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-teal-400" />
                    <span className="text-white/80 font-bold text-sm">Preset Mazzo</span>
                    <span className="text-white/40 text-xs">{presets.length}/3</span>
                  </div>
                  {presets.length < 3 && (
                    <button
                      onClick={() => setShowPresetDialog(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/30 rounded-lg text-teal-300 font-semibold transition-all"
                    >
                      <Plus className="w-3 h-3" />Salva corrente
                    </button>
                  )}
                </div>

                {presetMsg && (
                  <div className={`mx-4 mt-3 flex items-center gap-2 p-2.5 rounded-lg text-xs ${presetMsg.type === 'success' ? 'bg-green-900/40 border border-green-500/40 text-green-300' : 'bg-red-900/40 border border-red-500/40 text-red-300'}`}>
                    {presetMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                    {presetMsg.text}
                  </div>
                )}

                {showPresetDialog && (
                  <div className="mx-4 mt-3 p-3 bg-black/30 border border-white/15 rounded-xl space-y-2">
                    <p className="text-white/70 text-xs font-semibold">Nome preset (max 20 caratteri)</p>
                    <input
                      type="text"
                      value={presetNameInput}
                      onChange={e => setPresetNameInput(e.target.value.slice(0, 20))}
                      placeholder="Es: Mazzo offensivo"
                      maxLength={20}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-400/50"
                    />
                    <div className="flex gap-2">
                      <button onClick={savePreset} disabled={presetLoading || !presetNameInput.trim()} className="flex-1 py-2 bg-teal-600/50 hover:bg-teal-600/70 text-teal-200 font-semibold rounded-lg text-xs transition-all disabled:opacity-40">
                        {presetLoading ? '...' : 'Salva'}
                      </button>
                      <button onClick={() => { setShowPresetDialog(false); setPresetNameInput(''); }} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white/60 font-semibold rounded-lg text-xs transition-all">
                        Annulla
                      </button>
                    </div>
                  </div>
                )}

                {presets.length === 0 ? (
                  <div className="text-center py-6 px-4">
                    <Save className="w-8 h-8 text-white/15 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">Nessun preset salvato</p>
                    <p className="text-white/20 text-xs mt-1">Salva il tuo mazzo corrente come preset per ricaricarlo in seguito</p>
                  </div>
                ) : (
                  <div className="space-y-2 px-4 pt-3">
                    {presets.map(preset => (
                      <div key={preset.id} className="bg-black/20 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm">{preset.presetName}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-purple-300 text-xs">{(preset.personaggiCards || []).length} personaggi</span>
                            <span className="text-red-300 text-xs">{(preset.mosseCards || []).length} mosse</span>
                            <span className="text-cyan-300 text-xs">{(preset.bonusCards || []).length} bonus</span>
                          </div>
                          <p className="text-white/30 text-[10px] mt-0.5">{new Date(preset.createdAt).toLocaleDateString('it-IT')}</p>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => loadPreset(preset.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/30 text-teal-300 rounded-lg font-semibold transition-all"
                          >
                            <RotateCcw className="w-3 h-3" />Carica
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-500/20 text-red-400 rounded-lg font-semibold transition-all"
                          >
                            <Trash2 className="w-3 h-3" />Elimina
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ===== TAB: NEGOZIO CARTE ===== */}
          {activeTab === 'shop' && (
            <div className="max-w-5xl mx-auto space-y-3">

              {/* === Offerte Settimanali === */}
              {weeklyOffers.length > 0 && (
                <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-500/30 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300 font-bold text-sm">Offerte della Settimana</span>
                      <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">-50%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-white/30" />
                      <span className="text-white/40 text-xs">Scade tra {daysUntilReset}g</span>
                      <button
                        onClick={() => setShopFilter(shopFilter === 'offers' ? 'all' : 'offers')}
                        className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold transition-all ${shopFilter === 'offers' ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-amber-500/20 hover:text-amber-300'}`}
                      >
                        {shopFilter === 'offers' ? 'Tutte' : 'Solo offerte'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3">
                    {weeklyOffers.map(offer => {
                      const isOwned = ownedCardIds.has(offer.cardId);
                      const selected = selectedCards[offer.deckType as 'personaggi' | 'mosse' | 'bonus']?.includes(offer.cardId);
                      return (
                        <div
                          key={offer.cardId}
                          onClick={() => {
                            const card = allCards.find(c => c.id === offer.cardId);
                            if (card) toggleCard(card);
                          }}
                          className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-[1.03] ${
                            selected ? 'border-amber-400 shadow-lg shadow-amber-500/30' :
                            'border-amber-500/40 hover:border-amber-400/70'
                          }`}
                        >
                          {offer.frontImage && <img src={offer.frontImage} alt={offer.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />}
                          <div className="absolute top-1 right-1 bg-red-600/90 text-white text-[9px] px-1 py-0.5 rounded font-black">-50%</div>
                          {isOwned && <div className="absolute top-1 left-1 bg-emerald-700/90 text-emerald-200 text-[9px] px-1 py-0.5 rounded font-bold"><Check className="w-2 h-2 inline" /></div>}
                          {selected && <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center"><div className="bg-amber-500/90 rounded-full p-1"><Check className="w-4 h-4 text-white" /></div></div>}
                          <div className="bg-black/80 px-1.5 py-1">
                            <p className="text-white text-[10px] font-semibold truncate">{offer.name}</p>
                            <div className="flex items-center gap-1">
                              <span className="text-white/30 text-[9px] line-through">{offer.originalCost}</span>
                              <span className="text-amber-400 text-[10px] font-black">{offer.discountedCost}</span>
                              <Coins className="w-2 h-2 text-amber-400" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search + Sort */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cerca per nome..."
                    className="w-full pl-9 pr-9 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-teal-400/50 text-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                  className="bg-white/10 border border-white/20 rounded-xl text-white text-sm px-3 py-2.5 focus:outline-none focus:border-teal-400/50 cursor-pointer"
                >
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>)}
                </select>
              </div>

              {/* Type filters */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { f: 'all' as const, label: `Tutte (${allCards.length})` },
                  { f: 'personaggi' as const, label: `Personaggi (${deckTypeCardCounts.personaggi})`, sel: selectedCards.personaggi.length },
                  { f: 'mosse' as const, label: `Mosse (${deckTypeCardCounts.mosse})`, sel: selectedCards.mosse.length },
                  { f: 'bonus' as const, label: `Bonus (${deckTypeCardCounts.bonus})`, sel: selectedCards.bonus.length },
                  ...(weeklyOffers.length > 0 ? [{ f: 'offers' as const, label: `🔥 Offerte (${weeklyOffers.length})` }] : []),
                ]).map(({ f, label, sel }: { f: any; label: string; sel?: number }) => (
                  <button
                    key={f}
                    onClick={() => setShopFilter(f)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${shopFilter === f ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                  >
                    {label}
                    {sel !== undefined && sel > 0 && (
                      <span className={`px-1 py-0.5 rounded text-[10px] font-black ${shopFilter === f ? 'bg-white/20' : 'bg-teal-500/30 text-teal-300'}`}>{sel}/33</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Budget bar */}
              <div className="flex items-center gap-3 text-sm text-white/60 bg-black/20 rounded-lg px-3 py-2">
                <Coins className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Budget: <strong className="text-teal-300">{availableCredits.toLocaleString()}</strong> · Speso: <strong className={canAfford ? 'text-teal-300' : 'text-red-400'}>{totalCost.toLocaleString()}</strong></span>
                <span className="ml-auto text-xs text-white/40">{filteredAndSortedCards.length} carte</span>
              </div>

              {/* Card grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredAndSortedCards.map(card => {
                  const selected = selectedCards[card.deckType].includes(card.id);
                  const full = false; // No upper limit — minimum is 33 per type
                  const isFree = card.draftCost === 0;
                  const isOwned = ownedCardIds.has(card.id);
                  return (
                    <div
                      key={card.id}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        selected ? 'border-teal-400 shadow-lg shadow-teal-500/30 scale-[1.03]' :
                        isOwned ? 'border-emerald-400/50 shadow-md shadow-emerald-500/20' :
                        full ? 'border-white/10 opacity-40 cursor-not-allowed' :
                        'border-white/10 hover:border-white/40 hover:scale-[1.02]'
                      }`}
                      onClick={() => !full && toggleCard(card)}
                      onMouseEnter={() => setHoveredCard(card.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                      {/* Type badge */}
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          card.deckType === 'personaggi' ? 'bg-purple-700/90 text-purple-200' :
                          card.deckType === 'mosse' ? 'bg-red-700/90 text-red-200' :
                          'bg-cyan-700/90 text-cyan-200'
                        }`}>
                          {card.deckType === 'personaggi' ? 'P' : card.deckType === 'mosse' ? 'M' : 'B'}
                        </span>
                      </div>
                      {/* Cost badge */}
                      <div className="absolute top-1.5 right-1.5">
                        {isOwned ? (
                          <span className="flex items-center gap-0.5 bg-emerald-900/90 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
                            <Check className="w-2 h-2" />Posseduta
                          </span>
                        ) : isFree ? (
                          <span className="bg-green-900/90 text-green-300 text-[10px] px-1.5 py-0.5 rounded font-bold">FREE</span>
                        ) : (
                          <span className="flex items-center gap-0.5 bg-teal-900/90 text-teal-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            <Coins className="w-2 h-2" />{card.draftCost}
                          </span>
                        )}
                      </div>
                      {/* Selected overlay */}
                      {selected && (
                        <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                          <div className="bg-teal-500/90 rounded-full p-1.5 shadow-lg">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                      {/* Full overlay */}
                      {full && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white/60 text-[10px] font-bold bg-black/60 px-2 py-1 rounded">SLOT PIENI</span>
                        </div>
                      )}
                      {/* Card info */}
                      <div className="bg-black/80 px-2 py-1.5">
                        <p className="text-white text-xs font-semibold truncate leading-tight">{card.name}</p>
                        {(card.pti != null || card.stars != null) && (
                          <p className="text-white/40 text-[10px] leading-tight">
                            {card.pti != null ? `PTI: ${card.pti}` : ''}{card.stars ? ` · ★${card.stars}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredAndSortedCards.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">Nessuna carta trovata.</p>
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="mt-2 text-teal-400 text-sm underline">Cancella ricerca</button>}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB: PACCHETTI ===== */}
          {activeTab === 'packs' && (
            <div className="max-w-4xl mx-auto space-y-5">

              {/* === Carta del Giorno === */}
              <div className={`relative overflow-hidden rounded-2xl border-2 p-4 transition-all ${dailyCardStatus?.available ? 'border-amber-400/60 bg-gradient-to-br from-amber-900/40 to-yellow-900/30' : 'border-white/15 bg-white/5'}`}>
                {dailyCardStatus?.available && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent animate-pulse" />
                  </div>
                )}
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-amber-400" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-white font-bold text-base">Carta del Giorno</h3>
                    <p className="text-white/50 text-xs mt-0.5">Una carta casuale gratuita ogni 24 ore</p>
                    {!dailyCardStatus?.available && dailyCountdown && (
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 text-white/40" />
                        <span className="text-white/50 text-xs font-mono">Prossima tra {dailyCountdown}</span>
                      </div>
                    )}
                  </div>
                  {dailyCardStatus?.available ? (
                    <button
                      onClick={claimDailyCard}
                      disabled={claimingDaily}
                      className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50"
                    >
                      {claimingDaily ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Gift className="w-4 h-4" />}
                      RISCATTA GRATIS
                    </button>
                  ) : (
                    <div className="flex-shrink-0 text-center bg-black/30 rounded-xl px-4 py-2 border border-white/10">
                      <div className="text-white/30 text-xs mb-0.5">Già riscattata</div>
                      <div className="text-white/60 text-sm font-mono font-bold">{dailyCountdown || '—'}</div>
                    </div>
                  )}
                </div>
                {/* Daily result */}
                {dailyResult && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-4">
                    <div className="relative w-16 h-24 rounded-lg overflow-hidden border-2 border-amber-400/60 shadow-lg shadow-amber-500/30 flex-shrink-0">
                      <img src={dailyResult.frontImage} alt={dailyResult.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-amber-300 font-bold text-sm">{dailyResult.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${
                        dailyResult.rarity === 'leggendaria' ? 'bg-yellow-500/20 text-yellow-300' :
                        dailyResult.rarity === 'epica' ? 'bg-purple-500/20 text-purple-300' :
                        dailyResult.rarity === 'rara' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-gray-500/20 text-gray-300'
                      }`}>{dailyResult.rarity.charAt(0).toUpperCase() + dailyResult.rarity.slice(1)}</span>
                      <p className="text-white/50 text-xs mt-1">Aggiunta alla tua collezione!</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center">
                <h2 className="text-white font-bold text-xl flex items-center justify-center gap-2">
                  <Gift className="w-5 h-5 text-teal-400" /> Apri Pacchetti
                </h2>
                <p className="text-white/50 text-sm mt-1">Spendi i tuoi crediti per ottenere carte casuali</p>
                {status && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 bg-teal-900/40 border border-teal-500/30 rounded-lg px-3 py-1.5">
                      <Coins className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-teal-300 font-bold">{(status.totalCredits + status.puntiRankiard).toLocaleString()} crediti disponibili</span>
                    </div>
                    {ownedCardIds.size > 0 && (
                      <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300 font-bold">{ownedCardIds.size} carte in collezione</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {packError && (
                <div className="bg-red-900/40 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm text-center">
                  {packError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availablePacks.map(pack => {
                  const userTotal = status ? status.totalCredits + status.puntiRankiard : 0;
                  const canBuy = userTotal >= pack.creditsRequired;
                  const isOpening = openingPackId === pack.id;
                  return (
                    <div
                      key={pack.id}
                      className={`relative rounded-2xl overflow-hidden border transition-all ${canBuy ? 'border-white/20 hover:border-white/40 hover:scale-[1.01]' : 'border-white/10 opacity-70'}`}
                      style={{ background: pack.gradient }}
                    >
                      <div className="absolute inset-0 opacity-10"
                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 4px)' }} />
                      <div className="relative z-10 p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-white font-black text-lg">{pack.name}</h3>
                            <p className="text-white/70 text-sm mt-0.5">{pack.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-black text-2xl">{pack.creditsRequired.toLocaleString()}</div>
                            <div className="text-white/60 text-xs">crediti</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {pack.composition.split(' + ').map((part, i) => {
                            const rarityMap: Record<string, string> = {
                              'Comuni': 'bg-gray-500/30 text-gray-200 border-gray-400/30',
                              'Comune': 'bg-gray-500/30 text-gray-200 border-gray-400/30',
                              'Rare': 'bg-blue-500/30 text-blue-200 border-blue-400/30',
                              'Rara': 'bg-blue-500/30 text-blue-200 border-blue-400/30',
                              'Epiche': 'bg-purple-500/30 text-purple-200 border-purple-400/30',
                              'Epica': 'bg-purple-500/30 text-purple-200 border-purple-400/30',
                              'Leggendarie': 'bg-yellow-500/30 text-yellow-200 border-yellow-400/30',
                              'Leggendaria': 'bg-yellow-500/30 text-yellow-200 border-yellow-400/30',
                            };
                            const word = part.split(' ').slice(-1)[0];
                            const cls = rarityMap[word] || 'bg-white/10 text-white/60 border-white/20';
                            return (
                              <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cls}`}>{part}</span>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => canBuy && !isOpening && openPack(pack)}
                          disabled={!canBuy || isOpening}
                          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                            canBuy && !isOpening
                              ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm border border-white/30'
                              : 'bg-black/30 text-white/40 cursor-not-allowed border border-white/10'
                          }`}
                        >
                          {isOpening ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Apertura in corso...
                            </span>
                          ) : !canBuy ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" />
                              Crediti insufficienti
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-1.5">
                              <Gift className="w-3.5 h-3.5" />
                              Apri pacchetto
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {ownedCardIds.size > 0 && (
                <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold text-sm">Carte in collezione: {ownedCardIds.size}</span>
                  </div>
                  <p className="text-white/50 text-xs">Le carte già possedute sono gratuite nel deck builder. Vai al <button onClick={() => setActiveTab('shop')} className="text-teal-400 underline hover:text-teal-300">Negozio</button> per aggiungerle al tuo mazzo.</p>
                </div>
              )}

              {/* === Storico Aperture === */}
              {packHistory.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowPackHistory(!showPackHistory)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-white/50" />
                      <span className="text-white/80 font-semibold text-sm">Storico Aperture</span>
                      <span className="text-white/40 text-xs">({packHistory.filter(h => h.packId !== 'daily' && h.packId !== 'mission_claimed').length} pacchetti)</span>
                    </div>
                    {showPackHistory ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                  </button>
                  {showPackHistory && (
                    <div className="border-t border-white/10 divide-y divide-white/5">
                      {packHistory.filter(h => h.packId !== 'daily' && h.packId !== 'mission_claimed').slice(0, 10).map((entry) => {
                        const cards = Array.isArray(entry.cardsObtained) ? entry.cardsObtained : [];
                        const byCrarity: Record<string, number> = {};
                        cards.forEach((c: any) => { byCrarity[c.rarity] = (byCrarity[c.rarity] || 0) + 1; });
                        return (
                          <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/80 text-sm font-semibold capitalize">{entry.packId}</span>
                                <span className="text-white/30 text-xs">{new Date(entry.openedAt).toLocaleDateString('it-IT')}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {Object.entries(byCrarity).map(([r, n]) => (
                                  <span key={r} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${r === 'leggendaria' ? 'bg-yellow-500/20 text-yellow-300' : r === 'epica' ? 'bg-purple-500/20 text-purple-300' : r === 'rara' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                    {n} {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-white/50 text-xs">-{entry.creditsSpent} cr</div>
                              {entry.duplicatesCredits > 0 && (
                                <div className="text-emerald-400 text-xs">+{entry.duplicatesCredits} cr duplicati</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== TAB: COLLEZIONE ===== */}
          {activeTab === 'collection' && (() => {
            const RARITY_ORDER: Record<string, number> = { leggendaria: 0, epica: 1, rara: 2, comune: 3 };
            const filteredOwned = ownedCardDetails
              .filter(od => {
                if (collectionFilter !== 'all' && od.deckType !== collectionFilter) return false;
                if (collectionRarityFilter !== 'all' && od.rarity !== collectionRarityFilter) return false;
                return true;
              })
              .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9));
            const rarityCount = { comune: 0, rara: 0, epica: 0, leggendaria: 0 };
            ownedCardDetails.forEach(od => { if (od.rarity in rarityCount) rarityCount[od.rarity as keyof typeof rarityCount]++; });
            return (
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="text-center">
                  <h2 className="text-white font-bold text-xl flex items-center justify-center gap-2">
                    <BookOpen className="w-5 h-5 text-teal-400" /> La mia Collezione
                  </h2>
                  <p className="text-white/50 text-sm mt-1">{ownedCardIds.size} carte possedute</p>
                  <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                    {Object.entries(rarityCount).filter(([, n]) => n > 0).map(([r, n]) => (
                      <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${r === 'leggendaria' ? 'bg-yellow-500/20 text-yellow-300' : r === 'epica' ? 'bg-purple-500/20 text-purple-300' : r === 'rara' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-300'}`}>
                        {n} {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { f: 'all' as const, label: 'Tutte' },
                      { f: 'personaggi' as const, label: 'Personaggi' },
                      { f: 'mosse' as const, label: 'Mosse' },
                      { f: 'bonus' as const, label: 'Bonus' },
                    ]).map(({ f, label }) => (
                      <button key={f} onClick={() => setCollectionFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${collectionFilter === f ? 'bg-teal-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={collectionRarityFilter}
                    onChange={e => setCollectionRarityFilter(e.target.value as any)}
                    className="bg-white/10 border border-white/20 rounded-xl text-white text-xs px-3 py-2 focus:outline-none focus:border-teal-400/50 cursor-pointer"
                  >
                    <option value="all" className="bg-gray-900">Tutte le rarità</option>
                    <option value="leggendaria" className="bg-gray-900">Leggendarie</option>
                    <option value="epica" className="bg-gray-900">Epiche</option>
                    <option value="rara" className="bg-gray-900">Rare</option>
                    <option value="comune" className="bg-gray-900">Comuni</option>
                  </select>
                </div>

                {filteredOwned.length === 0 ? (
                  <div className="text-center py-16">
                    <BookOpen className="w-12 h-12 text-white/15 mx-auto mb-4" />
                    <p className="text-white/40 text-sm">Nessuna carta in questa categoria</p>
                    {ownedCardIds.size === 0 && <p className="text-white/30 text-xs mt-2">Apri pacchetti o riscatta la carta giornaliera per iniziare la tua collezione!</p>}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {filteredOwned.map(od => {
                      const card = allCards.find(c => c.id === od.cardId);
                      const inDeck = selectedCards[od.deckType as 'personaggi' | 'mosse' | 'bonus']?.includes(od.cardId);
                      return (
                        <div
                          key={od.cardId}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer hover:scale-[1.03] ${
                            od.rarity === 'leggendaria' ? 'border-yellow-400/60 shadow-lg shadow-yellow-500/20' :
                            od.rarity === 'epica' ? 'border-purple-400/60 shadow-lg shadow-purple-500/20' :
                            od.rarity === 'rara' ? 'border-blue-400/40' :
                            'border-white/15'
                          }`}
                          onClick={() => card && toggleCard(card)}
                          title={`${card?.name || od.cardId}\n${od.rarity} · ${od.deckType}\nClicca per aggiungere al mazzo`}
                        >
                          {card?.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
                              <span className="text-white/20 text-[10px]">?</span>
                            </div>
                          )}
                          {/* Rarity badge */}
                          <div className={`absolute top-0.5 right-0.5 text-[9px] px-1 py-0.5 rounded font-bold ${
                            od.rarity === 'leggendaria' ? 'bg-yellow-500/80 text-yellow-100' :
                            od.rarity === 'epica' ? 'bg-purple-500/80 text-purple-100' :
                            od.rarity === 'rara' ? 'bg-blue-500/80 text-blue-100' :
                            'bg-gray-600/80 text-gray-200'
                          }`}>{od.rarity.charAt(0).toUpperCase()}</div>
                          {/* In deck indicator */}
                          {inDeck && (
                            <div className="absolute top-0.5 left-0.5 bg-teal-500/90 rounded-full p-0.5">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          <div className="bg-black/80 px-1 py-0.5">
                            <p className="text-white text-[9px] font-semibold truncate leading-tight">{card?.name || od.cardId}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ===== TAB: ACQUISTA CREDITI ===== */}
          {activeTab === 'credits' && (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Credit summary */}
              {status && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Gratuiti', value: status.freeCredits, icon: Sparkles, colorCls: 'teal' },
                    { label: 'Acquistati', value: status.paidCredits, icon: CreditCard, colorCls: 'blue' },
                    { label: 'Punti Rankiard', value: status.puntiRankiard, icon: Trophy, colorCls: 'amber' },
                  ].map(({ label, value, icon: Icon, colorCls }) => (
                    <div key={label} className={`bg-black/30 border border-white/10 rounded-xl p-4 text-center`}>
                      <Icon className="w-5 h-5 mx-auto mb-1 text-white/40" />
                      <div className="text-white/50 text-xs mb-1">{label}</div>
                      <div className="text-white text-2xl font-black">{value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Info box */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200 leading-relaxed">
                <strong className="text-blue-300">Come funziona:</strong> Seleziona un pacchetto, effettua il pagamento (PayPal o bonifico), poi invia la richiesta con il riferimento. I crediti vengono aggiunti solitamente entro 24 ore.
              </div>

              {/* Packages */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CREDIT_PACKAGES.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(prev => prev === pkg.id ? null : pkg.id)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      selectedPackage === pkg.id ? 'border-teal-400 bg-teal-900/30 shadow-lg shadow-teal-500/20' : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap uppercase">
                        Più popolare
                      </div>
                    )}
                    <div className="flex items-center gap-1 mb-1.5">
                      <Coins className="w-4 h-4 text-teal-400" />
                      <span className="text-teal-300 font-black text-sm">{pkg.label}</span>
                    </div>
                    <div className="text-white text-2xl font-black">€{pkg.priceEur.toFixed(2)}</div>
                    <div className="text-white/40 text-xs mt-0.5">€{(pkg.priceEur / pkg.credits * 100).toFixed(2)}/100 cr.</div>
                    {selectedPackage === pkg.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Purchase form */}
              {selectedPackage && (() => {
                const pkg = CREDIT_PACKAGES.find(p => p.id === selectedPackage)!;
                return (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-bold">{pkg.label} — €{pkg.priceEur.toFixed(2)}</h4>
                      <button onClick={() => setSelectedPackage(null)} className="text-white/40 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="text-white/80 text-sm font-medium block mb-1.5">
                        Riferimento di pagamento <span className="text-white/40 font-normal">(opzionale)</span>
                      </label>
                      <input
                        type="text"
                        value={purchaseNote}
                        onChange={e => setPurchaseNote(e.target.value)}
                        placeholder="Es: ID transazione PayPal, data, metodo usato..."
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-teal-400/50"
                      />
                    </div>
                    {purchaseMsg && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${purchaseMsg.type === 'success' ? 'bg-green-900/40 border border-green-500/50 text-green-300' : 'bg-red-900/40 border border-red-500/50 text-red-300'}`}>
                        {purchaseMsg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                        {purchaseMsg.text}
                      </div>
                    )}
                    <button
                      onClick={handlePurchaseRequest}
                      disabled={purchaseLoading}
                      className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {purchaseLoading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Invio in corso...</>
                      ) : (
                        <><CreditCard className="w-4 h-4" />Invia richiesta</>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* Purchase history */}
              {purchases.length > 0 && (
                <div>
                  <h4 className="text-white/70 text-sm font-semibold mb-2">Storico richieste</h4>
                  <div className="space-y-2">
                    {purchases.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <span className="text-white font-semibold">{p.creditsAmount.toLocaleString()} crediti</span>
                          <span className="text-white/40 ml-2">€{(p.priceEur / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/30 text-xs">{new Date(p.createdAt).toLocaleDateString('it-IT')}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            p.status === 'approved' ? 'bg-green-900/50 text-green-300' :
                            p.status === 'rejected' ? 'bg-red-900/50 text-red-300' :
                            'bg-amber-900/50 text-amber-300'
                          }`}>
                            {p.status === 'approved' ? 'Approvato' : p.status === 'rejected' ? 'Rifiutato' : 'In attesa'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Pass Stagionale Tab */}
      {activeTab === 'pass' && (
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4">
          <SeasonPass
            userId={userId || 0}
            onClose={() => setActiveTab('deck')}
          />
        </div>
      )}

      {/* Marketplace Tab */}
      {activeTab === 'marketplace' && (
        <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4">
          <Marketplace
            userId={userId || 0}
            username={playerName}
            onClose={() => setActiveTab('deck')}
            preloadedCollection={ownedCardDetails.map(item => {
              const meta = allCards.find(c => c.id === item.cardId);
              return {
                cardId: item.cardId,
                cardName: meta?.name || item.cardId,
                cardType: item.deckType,
                cardRarity: item.rarity,
                cardImageUrl: meta?.imageUrl,
                count: 1,
              };
            })}
          />
        </div>
      )}

      {packAnimation && (
        <PackOpeningAnimation
          pack={packAnimation.pack}
          cards={packAnimation.cards}
          onClose={handleAnimationClose}
          onCardAdded={fetchDeck}
        />
      )}
    </div>
  );
}
