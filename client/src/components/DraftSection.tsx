import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Shuffle, ShoppingCart, CreditCard, Search, Plus, Minus, CheckCircle, AlertCircle, Coins, Users, Swords, Zap, Package, Check, Trophy, X, SortAsc, SortDesc, Sparkles, Trash2, Filter, Gift, Star, Lock, ChevronDown, ChevronUp, Clock, Target, Flame, BookOpen, Save, RotateCcw, Calendar, Ticket, Store, ChevronLeft, ChevronRight, Pencil, Copy } from 'lucide-react';
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
  isAdmin?: boolean;
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
  const [packAdminOpen, setPackAdminOpen] = useState(false);
  const [packAdminList, setPackAdminList] = useState<PackType[]>([]);
  const [packEditing, setPackEditing] = useState<string | null>(null);
  const [packCreating, setPackCreating] = useState(false);
  const emptyPackForm = { name: '', creditsRequired: 100, description: '', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e)', glowColor: '#4a9eff', slotsText: 'comune\ncomune\nrara' };
  const [packForm, setPackForm] = useState(emptyPackForm);
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

  // Draft character growth data
  const [growthData, setGrowthData] = useState<Record<string, { extraPti: number; extraStars: number }>>({});

  // Card viewer popup
  const [cardViewer, setCardViewer] = useState<{ deckType: 'personaggi' | 'mosse' | 'bonus'; index: number } | null>(null);
  const [cvSellPrice, setCvSellPrice] = useState(50);
  const [cvSelling, setCvSelling] = useState(false);
  const [cvSellMsg, setCvSellMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin mission editing
  const [editingMission, setEditingMission] = useState<string | null>(null);
  const [missionEditForm, setMissionEditForm] = useState({ name: '', description: '', rewardCredits: 0, requirement: 1, icon: '' });
  const [missionSaving, setMissionSaving] = useState(false);
  const [confirmDeleteMission, setConfirmDeleteMission] = useState<string | null>(null);
  const [creatingMission, setCreatingMission] = useState(false);
  const [missionCreateForm, setMissionCreateForm] = useState({ code: '', name: '', description: '', rewardCredits: 100, requirement: 1, icon: '🎯', progressKey: 'packCount' });
  const [missionCreating, setMissionCreating] = useState(false);
  const [missionCreateError, setMissionCreateError] = useState<string | null>(null);

  // Initial deck setup state
  const [showInitialChoice, setShowInitialChoice] = useState(false);
  const [generatingInitialDeck, setGeneratingInitialDeck] = useState(false);
  const [initialPackQueue, setInitialPackQueue] = useState<Array<{ pack: PackType; cards: RevealedCard[] }>>([]);
  const [currentInitialPack, setCurrentInitialPack] = useState<{ pack: PackType; cards: RevealedCard[] } | null>(null);
  const [unlockingCustom, setUnlockingCustom] = useState(false);
  const [showInsufficientMsg, setShowInsufficientMsg] = useState(false);
  const [initialDeckError, setInitialDeckError] = useState<string | null>(null);

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

  const parseSlotsText = (text: string) => {
    return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      if (line.includes('/')) {
        const alternatives = line.split('/').map(part => {
          const [rarity, weight] = part.trim().split(':');
          return { rarity: rarity.trim(), weight: parseInt(weight) || 50 };
        });
        return { alternatives };
      }
      return { rarity: line };
    });
  };

  const slotsToText = (slots: any[]) => {
    return slots.map(slot => {
      if (slot.alternatives) {
        return slot.alternatives.map((a: any) => `${a.rarity}:${a.weight}`).join('/');
      }
      return slot.rarity || 'comune';
    }).join('\n');
  };

  const fetchAdminPacks = async () => {
    try {
      const res = await fetch('/api/admin/packs', { headers: getAuthHeaders() });
      if (res.ok) setPackAdminList(await res.json());
    } catch (e) {}
  };

  const savePackAdmin = async (id: string | null, data: any) => {
    const url = id ? `/api/admin/packs/${id}` : '/api/admin/packs';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error('Errore salvataggio');
    return res.json();
  };

  const deletePackAdmin = async (id: string) => {
    await fetch(`/api/admin/packs/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  };

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

  const fetchGrowth = useCallback(async () => {
    try {
      const res = await fetch('/api/draft/growth', { headers: getAuthHeaders() });
      if (res.ok) {
        const rows: Array<{ cardId: string; extraPti: number; extraStars: number }> = await res.json();
        const map: Record<string, { extraPti: number; extraStars: number }> = {};
        for (const row of rows) {
          if (row.extraPti > 0 || row.extraStars > 0) {
            map[row.cardId] = { extraPti: row.extraPti, extraStars: row.extraStars };
          }
        }
        setGrowthData(map);
      }
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
      let parsedUserId: number | null = null;
      if (statusRes.ok) {
        const s = await statusRes.json();
        setStatus(s);
        parsedUserId = s.userId || null;
      }
      if (deckRes.ok) {
        const d = await deckRes.json();
        setSelectedCards({
          personaggi: d.personaggiCards || [],
          mosse: d.mosseCards || [],
          bonus: d.bonusCards || [],
        });
        // Detect first-time deck builder
        const isDeckEmpty = !(d.personaggiCards?.length) && !(d.mosseCards?.length) && !(d.bonusCards?.length);
        const resolvedId = parsedUserId ?? userId;
        const setupKey = `draftSetupDone_${resolvedId}`;
        if (isDeckEmpty && !localStorage.getItem(setupKey)) {
          setShowInitialChoice(true);
        }
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
    fetchGrowth();
  }, [fetchAll, fetchPurchaseHistory, fetchCollection, fetchPacks, fetchDailyCard, fetchPackHistory, fetchWeeklyOffers, fetchPresets, fetchMissions, fetchGrowth]);

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

  // Process initial pack animation queue
  useEffect(() => {
    if (!currentInitialPack && initialPackQueue.length > 0) {
      const [next, ...rest] = initialPackQueue;
      setCurrentInitialPack(next);
      setInitialPackQueue(rest);
    }
  }, [currentInitialPack, initialPackQueue]);

  const handleInitialPackClose = () => {
    setCurrentInitialPack(null);
    if (initialPackQueue.length === 0) {
      fetchAll();
      fetchCollection();
    }
  };

  const INITIAL_BASE_PACK: PackType = {
    id: 'initial',
    name: 'Mazzo Iniziale',
    creditsRequired: 0,
    cardCount: 33,
    description: 'Il tuo primo mazzo automatico!',
    gradient: 'from-purple-700 to-teal-600',
    glowColor: 'rgba(139, 92, 246, 0.6)',
    composition: '33 carte',
  };

  const handleGenerateInitialDeck = async () => {
    setGeneratingInitialDeck(true);
    setInitialDeckError(null);
    try {
      const res = await fetch('/api/draft/generate-initial-deck', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setInitialDeckError(data.error || 'Errore nella generazione del mazzo');
        return;
      }
      const resolvedId = (status as any)?.userId ?? userId;
      localStorage.setItem(`draftSetupDone_${resolvedId}`, '1');
      setShowInitialChoice(false);
      const queue = [
        { pack: { ...INITIAL_BASE_PACK, name: 'Personaggi – Mazzo Iniziale' }, cards: data.personaggiCards as RevealedCard[] },
        { pack: { ...INITIAL_BASE_PACK, name: 'Mosse – Mazzo Iniziale' }, cards: data.mosseCards as RevealedCard[] },
        { pack: { ...INITIAL_BASE_PACK, name: 'Bonus – Mazzo Iniziale' }, cards: data.bonusCards as RevealedCard[] },
      ];
      setInitialPackQueue(queue);
    } catch (e: any) {
      setInitialDeckError(e.message || 'Errore di rete');
    } finally {
      setGeneratingInitialDeck(false);
    }
  };

  const handleUnlockCustomDeck = async () => {
    const totalAvailable = status ? status.totalCredits + status.puntiRankiard : 0;
    if (totalAvailable < 1000) {
      setShowInsufficientMsg(true);
      return;
    }
    setUnlockingCustom(true);
    try {
      const res = await fetch('/api/draft/unlock-custom-deck', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const resolvedId = (status as any)?.userId ?? userId;
        localStorage.setItem(`draftSetupDone_${resolvedId}`, '1');
        setShowInitialChoice(false);
        await fetchAll();
      } else {
        setShowInsufficientMsg(true);
      }
    } catch (e) {
      setShowInsufficientMsg(true);
    } finally {
      setUnlockingCustom(false);
    }
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

  const handleCardViewerSell = async () => {
    if (!cardViewer) return;
    const deckCards = selectedCards[cardViewer.deckType].map(id => getCardById(id)).filter(Boolean) as DraftCard[];
    const card = deckCards[cardViewer.index];
    if (!card) return;
    const rarity = ownedCardDetails.find(d => d.cardId === card.id)?.rarity || 'comune';
    const growth = cardViewer.deckType === 'personaggi' ? growthData[card.id] : undefined;
    const effectivePti = card.pti != null ? card.pti + (growth?.extraPti ?? 0) : null;
    const effectiveStars = card.stars != null ? card.stars + (growth?.extraStars ?? 0) : null;
    setCvSelling(true);
    setCvSellMsg(null);
    try {
      const res = await fetch('/api/marketplace/list', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          cardId: card.id,
          cardName: card.name,
          cardType: cardViewer.deckType,
          cardRarity: rarity,
          cardImageUrl: card.imageUrl,
          priceCredits: cvSellPrice,
          cardPti: effectivePti,
          cardStars: effectiveStars,
          originalCost: card.draftCost ?? null,
        }),
      });
      if (res.ok) {
        setCvSellMsg({ type: 'success', text: 'Carta messa in vendita nel marketplace!' });
        setTimeout(() => { setCvSellMsg(null); setCardViewer(null); }, 2000);
      } else {
        const e = await res.json();
        setCvSellMsg({ type: 'error', text: e.error || 'Errore nella vendita' });
      }
    } catch {
      setCvSellMsg({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setCvSelling(false);
    }
  };

  const handleMissionSave = async (code: string) => {
    setMissionSaving(true);
    try {
      const res = await fetch(`/api/draft/missions/templates/${code}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(missionEditForm),
      });
      if (res.ok) {
        setEditingMission(null);
        fetchMissions();
      }
    } catch {}
    setMissionSaving(false);
  };

  const handleMissionDelete = async (code: string) => {
    try {
      const res = await fetch(`/api/draft/missions/templates/${code}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setConfirmDeleteMission(null);
        fetchMissions();
      }
    } catch {}
  };

  const handleMissionDuplicate = (m: any) => {
    setMissionCreateForm({
      code: '',
      name: m.name + ' (copia)',
      description: m.description,
      rewardCredits: m.rewardCredits,
      requirement: m.requirement,
      icon: m.icon,
      progressKey: m.progressKey,
    });
    setMissionCreateError(null);
    setCreatingMission(true);
  };

  const handleMissionCreate = async () => {
    setMissionCreating(true);
    setMissionCreateError(null);
    try {
      const res = await fetch('/api/draft/missions/templates', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(missionCreateForm),
      });
      if (res.ok) {
        setCreatingMission(false);
        setMissionCreateForm({ code: '', name: '', description: '', rewardCredits: 100, requirement: 1, icon: '🎯', progressKey: 'packCount' });
        fetchMissions();
      } else {
        const e = await res.json();
        setMissionCreateError(e.error || 'Errore nella creazione');
      }
    } catch {
      setMissionCreateError('Errore di connessione');
    }
    setMissionCreating(false);
  };

  const autoCodeFromName = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

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

      {/* Initial deck choice screen */}
      {showInitialChoice && !loading && (
        <div className="relative z-20 flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-teal-600 mb-4 shadow-lg shadow-purple-900/40">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Benvenuto nel Draft!</h2>
              <p className="text-white/60 text-sm max-w-md mx-auto">
                È la tua prima volta qui. Scegli come costruire il tuo mazzo da 99 carte.
              </p>
              {status && (
                <div className="inline-flex items-center gap-2 mt-3 bg-teal-900/30 border border-teal-500/30 rounded-xl px-3 py-1.5">
                  <Coins className="w-4 h-4 text-teal-400" />
                  <span className="text-teal-300 font-semibold text-sm">
                    {(status.totalCredits + status.puntiRankiard).toLocaleString()} crediti disponibili
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Opzione 1: Genera automaticamente */}
              <div className="bg-gradient-to-br from-teal-900/50 to-cyan-900/30 border border-teal-500/40 rounded-2xl p-5 flex flex-col gap-3 hover:border-teal-400/60 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-600/40 flex items-center justify-center flex-shrink-0">
                    <Shuffle className="w-5 h-5 text-teal-300" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Genera mazzo iniziale</h3>
                    <p className="text-teal-400 text-xs font-medium">~495-500 crediti</p>
                  </div>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  Il sistema seleziona automaticamente 33 personaggi, 33 mosse e 33 bonus casuali usando quasi tutti i tuoi crediti iniziali.
                </p>
                <div className="mt-auto">
                  {initialDeckError && (
                    <p className="text-red-400 text-xs mb-2">{initialDeckError}</p>
                  )}
                  <button
                    onClick={handleGenerateInitialDeck}
                    disabled={generatingInitialDeck}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generatingInitialDeck ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generazione...
                      </>
                    ) : (
                      <>
                        <Shuffle className="w-4 h-4" />
                        Genera mazzo iniziale
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Opzione 2: Mazzo personalizzato */}
              <div className="bg-gradient-to-br from-purple-900/50 to-indigo-900/30 border border-purple-500/40 rounded-2xl p-5 flex flex-col gap-3 hover:border-purple-400/60 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/40 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Crea il tuo mazzo personalizzato</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <p className="text-amber-400 text-xs font-medium">Costa 1000 crediti per sbloccare</p>
                    </div>
                  </div>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  Paga 1000 crediti (sommando crediti e Punti Rankiard) per accedere alla selezione manuale di ogni carta del tuo mazzo.
                </p>
                {showInsufficientMsg && (
                  <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/40 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-xs leading-relaxed">
                      Non hai abbastanza crediti. Acquistane altri nell'apposita sezione Crediti oppure accumula Punti Rankiard giocando.
                    </p>
                  </div>
                )}
                <div className="mt-auto">
                  {status && (
                    <p className="text-white/40 text-xs mb-2">
                      Disponibili: {(status.totalCredits + status.puntiRankiard).toLocaleString()} / 1000
                    </p>
                  )}
                  <button
                    onClick={handleUnlockCustomDeck}
                    disabled={unlockingCustom}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {unlockingCustom ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sblocco in corso...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Crea il tuo mazzo personalizzato
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={`relative z-10 flex border-b border-white/10 bg-black/10 flex-shrink-0 overflow-x-auto${showInitialChoice ? ' hidden' : ''}`}>
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
      ) : showInitialChoice ? null : (
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

              {/* Save button at top */}
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
                        {deckCards.map((card, cardIdx) => {
                          const growth = key === 'personaggi' ? growthData[card.id] : undefined;
                          const totalPti = card.pti != null ? card.pti + (growth?.extraPti ?? 0) : undefined;
                          const totalStars = card.stars != null ? card.stars + (growth?.extraStars ?? 0) : undefined;
                          const hasGrowth = growth && (growth.extraPti > 0 || growth.extraStars > 0);
                          const ptiTitle = totalPti != null
                            ? `PTI: ${totalPti}${hasGrowth && growth.extraPti > 0 ? ` (base ${card.pti} +${growth.extraPti})` : ''}`
                            : '';
                          const starsTitle = totalStars != null
                            ? `⭐ ${totalStars}${hasGrowth && growth.extraStars > 0 ? ` (base ${card.stars} +${growth.extraStars})` : ''}`
                            : '';
                          return (
                          <div
                            key={card.id}
                            className="relative group rounded-lg overflow-hidden bg-black/30 border border-white/10 hover:border-teal-400/50 transition-all cursor-pointer"
                            onClick={() => setCardViewer({ deckType: key, index: cardIdx })}
                            title={`${card.name}${card.draftCost > 0 ? ` — ${card.draftCost} crediti` : ' — Gratuita'}${ptiTitle ? `\n${ptiTitle}` : ''}${starsTitle ? `  ${starsTitle}` : ''}\nClicca per dettagli`}
                          >
                            <img src={card.imageUrl} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-teal-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Search className="w-4 h-4 text-white drop-shadow" />
                            </div>
                            {card.draftCost > 0 && (
                              <div className="absolute top-0.5 right-0.5 bg-teal-900/90 text-teal-300 text-[10px] px-1 py-0.5 rounded font-bold leading-none">
                                {card.draftCost}
                              </div>
                            )}
                            {(totalPti != null || totalStars != null) && (
                              <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${hasGrowth ? 'from-emerald-900/95' : 'from-black/80'} to-transparent px-1 pt-2 pb-0.5`}>
                                <div className="flex items-center justify-center gap-0.5 flex-wrap">
                                  {totalPti != null && (
                                    <span className={`text-[9px] font-bold leading-none whitespace-nowrap ${hasGrowth && growth.extraPti > 0 ? 'text-emerald-300' : 'text-white/60'}`}>
                                      {totalPti} PTI
                                    </span>
                                  )}
                                  {totalStars != null && totalStars > 0 && (
                                    <span className={`text-[9px] font-bold leading-none whitespace-nowrap ${hasGrowth && growth.extraStars > 0 ? 'text-yellow-300' : 'text-white/50'}`}>
                                      {'⭐'.repeat(Math.min(totalStars, 5))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
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

              {/* === Missioni Draft === */}
              {(missions.length > 0 || status?.isAdmin) && (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                    <Target className="w-4 h-4 text-purple-400" />
                    <span className="text-white/80 font-bold text-sm">Missioni Draft</span>
                    <span className="text-white/40 text-xs ml-1">
                      {missions.filter(m => m.claimed).length}/{missions.length} completate
                    </span>
                    {status?.isAdmin && (
                      <button
                        onClick={() => { setCreatingMission(true); setMissionCreateForm({ code: '', name: '', description: '', rewardCredits: 100, requirement: 1, icon: '🎯', progressKey: 'packCount' }); setMissionCreateError(null); }}
                        className="ml-auto flex items-center gap-1 text-[10px] px-2 py-1 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/30 rounded-lg text-teal-300 font-semibold transition-all"
                        title="Crea nuova missione"
                      >
                        <Plus className="w-3 h-3" />Nuova
                      </button>
                    )}
                  </div>

                  {/* Create mission form */}
                  {status?.isAdmin && creatingMission && (
                    <div className="mx-4 my-3 p-3 bg-teal-900/20 border border-teal-500/30 rounded-xl space-y-2">
                      <p className="text-teal-300 text-xs font-bold uppercase tracking-wide">Nuova Missione (Admin)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-white/50 text-[10px]">Icona</label>
                          <input type="text" value={missionCreateForm.icon} onChange={e => setMissionCreateForm(f => ({ ...f, icon: e.target.value }))} maxLength={4} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400/50" placeholder="🎯" />
                        </div>
                        <div>
                          <label className="text-white/50 text-[10px]">Ricompensa (crediti)</label>
                          <input type="number" min={1} max={9999} value={missionCreateForm.rewardCredits} onChange={e => setMissionCreateForm(f => ({ ...f, rewardCredits: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400/50" />
                        </div>
                      </div>
                      <div>
                        <label className="text-white/50 text-[10px]">Nome</label>
                        <input
                          type="text"
                          value={missionCreateForm.name}
                          onChange={e => setMissionCreateForm(f => ({ ...f, name: e.target.value, code: f.code || autoCodeFromName(e.target.value) }))}
                          maxLength={60}
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400/50"
                          placeholder="Nome della missione"
                        />
                      </div>
                      <div>
                        <label className="text-white/50 text-[10px]">Descrizione</label>
                        <input type="text" value={missionCreateForm.description} onChange={e => setMissionCreateForm(f => ({ ...f, description: e.target.value }))} maxLength={120} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400/50" placeholder="Descrizione per i giocatori" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-white/50 text-[10px]">Obiettivo (numero)</label>
                          <input type="number" min={1} max={999} value={missionCreateForm.requirement} onChange={e => setMissionCreateForm(f => ({ ...f, requirement: parseInt(e.target.value) || 1 }))} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400/50" />
                        </div>
                        <div>
                          <label className="text-white/50 text-[10px]">Tipo di progresso</label>
                          <select value={missionCreateForm.progressKey} onChange={e => setMissionCreateForm(f => ({ ...f, progressKey: e.target.value }))} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400/50">
                            <option value="packCount">Pacchetti aperti</option>
                            <option value="deckComplete">Mazzo completato</option>
                            <option value="epicCount">Carte Epiche ottenute</option>
                            <option value="dailyCount">Carte giornaliere riscattate</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-white/50 text-[10px]">Codice univoco (auto-generato)</label>
                        <input type="text" value={missionCreateForm.code} onChange={e => setMissionCreateForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))} maxLength={40} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white/70 text-xs focus:outline-none focus:border-teal-400/50 font-mono" placeholder="codice_univoco" />
                      </div>
                      {missionCreateError && <p className="text-red-400 text-xs">{missionCreateError}</p>}
                      <div className="flex gap-2">
                        <button onClick={handleMissionCreate} disabled={missionCreating || !missionCreateForm.name || !missionCreateForm.code} className="flex-1 py-1.5 bg-teal-600/50 hover:bg-teal-600/70 border border-teal-500/50 rounded-lg text-teal-200 font-bold text-xs transition-all disabled:opacity-50">
                          {missionCreating ? '...' : 'Crea'}
                        </button>
                        <button onClick={() => setCreatingMission(false)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/50 text-xs transition-all">Annulla</button>
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-white/5">
                    {missions.map(m => (
                      <div key={m.code} className={`${m.claimed ? 'opacity-50' : ''}`}>
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="text-xl flex-shrink-0">{m.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-white/90 text-sm font-semibold">{m.name}</span>
                              {m.claimed && <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                              {status?.isAdmin && editingMission !== m.code && (
                                <>
                                  {/* Pencil — edit */}
                                  <button
                                    onClick={() => { setEditingMission(m.code); setConfirmDeleteMission(null); setMissionEditForm({ name: m.name, description: m.description, rewardCredits: m.rewardCredits, requirement: m.requirement, icon: m.icon }); }}
                                    className="p-0.5 rounded text-purple-400/70 hover:text-purple-300 transition-colors"
                                    title="Modifica missione"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  {/* Duplicate */}
                                  <button
                                    onClick={() => handleMissionDuplicate(m)}
                                    className="p-0.5 rounded text-teal-400/60 hover:text-teal-300 transition-colors"
                                    title="Duplica come base per nuova missione"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  {/* Delete with confirmation */}
                                  {confirmDeleteMission !== m.code ? (
                                    <button
                                      onClick={() => setConfirmDeleteMission(m.code)}
                                      className="p-0.5 rounded text-white/30 hover:text-red-400 transition-colors"
                                      title="Elimina missione"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <span className="flex items-center gap-1 ml-1">
                                      <span className="text-red-400 text-[10px]">Elimina?</span>
                                      <button onClick={() => handleMissionDelete(m.code)} className="text-[10px] px-1.5 py-0.5 bg-red-600/60 hover:bg-red-600/80 rounded text-white font-bold transition-all">Sì</button>
                                      <button onClick={() => setConfirmDeleteMission(null)} className="text-[10px] px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-white/50 transition-all">No</button>
                                    </span>
                                  )}
                                </>
                              )}
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
                        {status?.isAdmin && editingMission === m.code && (
                          <div className="mx-4 mb-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl space-y-2">
                            <p className="text-purple-300 text-xs font-bold uppercase tracking-wide">Modifica Missione (Admin)</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-white/50 text-[10px]">Icona</label>
                                <input type="text" value={missionEditForm.icon} onChange={e => setMissionEditForm(f => ({ ...f, icon: e.target.value }))} maxLength={4} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/50" placeholder="🎯" />
                              </div>
                              <div>
                                <label className="text-white/50 text-[10px]">Ricompensa (crediti)</label>
                                <input type="number" min={1} max={9999} value={missionEditForm.rewardCredits} onChange={e => setMissionEditForm(f => ({ ...f, rewardCredits: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/50" />
                              </div>
                            </div>
                            <div>
                              <label className="text-white/50 text-[10px]">Nome</label>
                              <input type="text" value={missionEditForm.name} onChange={e => setMissionEditForm(f => ({ ...f, name: e.target.value }))} maxLength={60} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/50" />
                            </div>
                            <div>
                              <label className="text-white/50 text-[10px]">Descrizione</label>
                              <input type="text" value={missionEditForm.description} onChange={e => setMissionEditForm(f => ({ ...f, description: e.target.value }))} maxLength={120} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/50" />
                            </div>
                            <div>
                              <label className="text-white/50 text-[10px]">Obiettivo (numero)</label>
                              <input type="number" min={1} max={999} value={missionEditForm.requirement} onChange={e => setMissionEditForm(f => ({ ...f, requirement: parseInt(e.target.value) || 1 }))} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/50" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleMissionSave(m.code)} disabled={missionSaving} className="flex-1 py-1.5 bg-purple-600/50 hover:bg-purple-600/70 border border-purple-500/50 rounded-lg text-purple-200 font-bold text-xs transition-all disabled:opacity-50">
                                {missionSaving ? '...' : 'Salva'}
                              </button>
                              <button onClick={() => setEditingMission(null)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/50 text-xs transition-all">
                                Annulla
                              </button>
                            </div>
                          </div>
                        )}
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
                  const shopGrowth = card.deckType === 'personaggi' ? growthData[card.id] : undefined;
                  const shopTotalPti = card.pti != null ? card.pti + (shopGrowth?.extraPti ?? 0) : undefined;
                  const shopTotalStars = card.stars != null ? card.stars + (shopGrowth?.extraStars ?? 0) : undefined;
                  const shopHasGrowth = shopGrowth && (shopGrowth.extraPti > 0 || shopGrowth.extraStars > 0);
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
                        {(shopTotalPti != null || shopTotalStars != null) && (
                          <p className="text-[10px] leading-tight">
                            {shopTotalPti != null && (
                              <span className={shopHasGrowth && shopGrowth.extraPti > 0 ? 'text-emerald-400' : 'text-white/40'}>
                                PTI: {shopTotalPti}
                              </span>
                            )}
                            {shopTotalStars != null && shopTotalStars > 0 && (
                              <span className={shopHasGrowth && shopGrowth.extraStars > 0 ? 'text-yellow-400' : 'text-white/40'}>
                                {shopTotalPti != null ? ' · ' : ''}★{shopTotalStars}
                              </span>
                            )}
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

                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-white/60 text-sm bg-white/10 border border-white/20 rounded-full px-3 py-1 font-semibold">
                            📦 {pack.cardCount} carte
                          </span>
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

              {/* === Admin: Gestione Pacchetti === */}
              {status?.isAdmin && (
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl overflow-hidden">
                  <button
                    onClick={async () => { if (!packAdminOpen) await fetchAdminPacks(); setPackAdminOpen(!packAdminOpen); setPackEditing(null); setPackCreating(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 text-sm">⚙️</span>
                      <span className="text-orange-300 font-semibold text-sm">Gestione Pacchetti (Admin)</span>
                    </div>
                    {packAdminOpen ? <ChevronUp className="w-4 h-4 text-orange-400/60" /> : <ChevronDown className="w-4 h-4 text-orange-400/60" />}
                  </button>
                  {packAdminOpen && (
                    <div className="border-t border-orange-500/20 p-4 space-y-3">
                      {/* Pack list */}
                      {packAdminList.map(p => (
                        <div key={p.id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                          {packEditing === p.id ? (
                            <div className="space-y-2">
                              <input value={packForm.name} onChange={e => setPackForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome" className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                              <div className="flex gap-2">
                                <input type="number" value={packForm.creditsRequired} onChange={e => setPackForm(f => ({ ...f, creditsRequired: parseInt(e.target.value) || 0 }))} placeholder="Costo crediti" className="flex-1 px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                                <input value={packForm.glowColor} onChange={e => setPackForm(f => ({ ...f, glowColor: e.target.value }))} placeholder="Glow #hex" className="flex-1 px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                              </div>
                              <input value={packForm.description} onChange={e => setPackForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrizione" className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                              <input value={packForm.gradient} onChange={e => setPackForm(f => ({ ...f, gradient: e.target.value }))} placeholder="CSS gradient" className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                              <div>
                                <div className="text-white/40 text-[10px] mb-1">Slot (uno per riga: "comune", "rara", "epica:90/leggendaria:10")</div>
                                <textarea value={packForm.slotsText} onChange={e => setPackForm(f => ({ ...f, slotsText: e.target.value }))} rows={6} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50 font-mono" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={async () => { try { const slots = parseSlotsText(packForm.slotsText); await savePackAdmin(p.id, { name: packForm.name, creditsRequired: packForm.creditsRequired, description: packForm.description, gradient: packForm.gradient, glowColor: packForm.glowColor, slots }); await fetchAdminPacks(); const res2 = await fetch('/api/draft/packs', { headers: getAuthHeaders() }); if (res2.ok) { const d = await res2.json(); if (d.packs) setAvailablePacks(d.packs); } setPackEditing(null); } catch(e) { alert('Errore salvataggio'); } }} className="flex-1 px-3 py-1.5 bg-orange-500/30 border border-orange-400/50 text-orange-300 hover:bg-orange-500/50 rounded-lg text-xs font-semibold">Salva</button>
                                <button onClick={() => setPackEditing(null)} className="px-3 py-1.5 bg-white/10 border border-white/20 text-white/60 hover:bg-white/20 rounded-lg text-xs">Annulla</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-semibold text-sm">{p.name}</div>
                                <div className="text-white/50 text-xs">{p.creditsRequired} cr · {p.cardCount} carte</div>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => { setPackEditing(p.id); setPackForm({ name: p.name, creditsRequired: p.creditsRequired, description: p.description || '', gradient: p.gradient || '', glowColor: p.glowColor || '', slotsText: slotsToText((p as any).slots || []) }); }} className="px-2.5 py-1 bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500/40 rounded text-xs">Modifica</button>
                                <button onClick={async () => { if (confirm('Eliminare questo pacchetto?')) { await deletePackAdmin(p.id); await fetchAdminPacks(); const res2 = await fetch('/api/draft/packs', { headers: getAuthHeaders() }); if (res2.ok) { const d = await res2.json(); if (d.packs) setAvailablePacks(d.packs); } } }} className="px-2.5 py-1 bg-red-500/20 border border-red-400/40 text-red-300 hover:bg-red-500/40 rounded text-xs">Elimina</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Create new pack */}
                      {packCreating ? (
                        <div className="bg-black/30 border border-orange-400/30 rounded-lg p-3 space-y-2">
                          <div className="text-orange-300 text-xs font-semibold mb-2">Nuovo Pacchetto</div>
                          <input value={packForm.name} onChange={e => setPackForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome" className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                          <div className="flex gap-2">
                            <input type="number" value={packForm.creditsRequired} onChange={e => setPackForm(f => ({ ...f, creditsRequired: parseInt(e.target.value) || 0 }))} placeholder="Costo crediti" className="flex-1 px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                            <input value={packForm.glowColor} onChange={e => setPackForm(f => ({ ...f, glowColor: e.target.value }))} placeholder="Glow #hex" className="flex-1 px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                          </div>
                          <input value={packForm.description} onChange={e => setPackForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrizione" className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                          <input value={packForm.gradient} onChange={e => setPackForm(f => ({ ...f, gradient: e.target.value }))} placeholder="CSS gradient (es: linear-gradient(135deg, #1a1a2e, #16213e))" className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50" />
                          <div>
                            <div className="text-white/40 text-[10px] mb-1">Slot (uno per riga: "comune", "rara", "epica:90/leggendaria:10")</div>
                            <textarea value={packForm.slotsText} onChange={e => setPackForm(f => ({ ...f, slotsText: e.target.value }))} rows={6} className="w-full px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-orange-400/50 font-mono" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={async () => { try { const slots = parseSlotsText(packForm.slotsText); await savePackAdmin(null, { name: packForm.name, creditsRequired: packForm.creditsRequired, description: packForm.description, gradient: packForm.gradient, glowColor: packForm.glowColor, slots }); await fetchAdminPacks(); const res2 = await fetch('/api/draft/packs', { headers: getAuthHeaders() }); if (res2.ok) { const d = await res2.json(); if (d.packs) setAvailablePacks(d.packs); } setPackCreating(false); setPackForm(emptyPackForm); } catch(e) { alert('Errore salvataggio'); } }} className="flex-1 px-3 py-1.5 bg-orange-500/30 border border-orange-400/50 text-orange-300 hover:bg-orange-500/50 rounded-lg text-xs font-semibold">Crea Pacchetto</button>
                            <button onClick={() => { setPackCreating(false); setPackForm(emptyPackForm); }} className="px-3 py-1.5 bg-white/10 border border-white/20 text-white/60 hover:bg-white/20 rounded-lg text-xs">Annulla</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setPackCreating(true); setPackEditing(null); setPackForm(emptyPackForm); }} className="w-full py-2 bg-orange-500/20 border border-orange-400/40 text-orange-300 hover:bg-orange-500/30 rounded-lg text-sm font-semibold">
                          + Crea nuovo pacchetto
                        </button>
                      )}
                    </div>
                  )}
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
      {activeTab === 'marketplace' && (() => {
        const marketplaceCollection = ownedCardDetails.map(item => {
          const meta = allCards.find(c => c.id === item.cardId);
          return {
            cardId: item.cardId,
            cardName: meta?.name || item.cardId,
            cardType: item.deckType || meta?.deckType || '',
            cardRarity: item.rarity || 'comune',
            cardImageUrl: meta?.imageUrl,
            count: 1,
          };
        });
        return (
          <div className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-4">
            <Marketplace
              userId={userId || 0}
              username={playerName}
              onClose={() => setActiveTab('deck')}
              preloadedCollection={marketplaceCollection}
            />
          </div>
        );
      })()}

      {packAnimation && (
        <PackOpeningAnimation
          pack={packAnimation.pack}
          cards={packAnimation.cards}
          onClose={handleAnimationClose}
          onCardAdded={fetchDeck}
          autoAddToDeck={true}
        />
      )}

      {currentInitialPack && (
        <PackOpeningAnimation
          pack={currentInitialPack.pack}
          cards={currentInitialPack.cards}
          onClose={handleInitialPackClose}
          onCardAdded={() => {}}
        />
      )}

      {/* Card Viewer Popup */}
      {cardViewer && (() => {
        const deckCards = selectedCards[cardViewer.deckType].map(id => getCardById(id)).filter(Boolean) as DraftCard[];
        const card = deckCards[cardViewer.index];
        if (!card) return null;
        const growth = cardViewer.deckType === 'personaggi' ? growthData[card.id] : undefined;
        const rarity = ownedCardDetails.find(d => d.cardId === card.id)?.rarity || 'comune';
        const deckTypeLabel = DECK_TYPES.find(d => d.key === cardViewer.deckType)?.label || cardViewer.deckType;
        const rarityColors: Record<string, string> = { comune: 'text-gray-300', rara: 'text-blue-300', epica: 'text-purple-300', leggendaria: 'text-yellow-300' };
        const hasPrev = cardViewer.index > 0;
        const hasNext = cardViewer.index < deckCards.length - 1;
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setCardViewer(null)}>
            <div className="relative bg-slate-900 border border-white/20 rounded-2xl p-4 max-w-xs w-full mx-4 flex flex-col items-center shadow-2xl" onClick={e => e.stopPropagation()}>
              <button onClick={() => setCardViewer(null)} className="absolute top-3 right-3 text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>

              {/* Navigation arrows */}
              <div className="flex items-center gap-3 w-full mb-3">
                <button disabled={!hasPrev} onClick={() => setCardViewer(prev => prev ? { ...prev, index: prev.index - 1 } : null)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex-1 text-center text-white/40 text-xs">{cardViewer.index + 1} / {deckCards.length} {deckTypeLabel}</div>
                <button disabled={!hasNext} onClick={() => setCardViewer(prev => prev ? { ...prev, index: prev.index + 1 } : null)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Card image */}
              <div className="w-full max-w-[180px] aspect-[2/3] rounded-xl overflow-hidden border border-white/20 mb-3 shadow-lg">
                <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
              </div>

              {/* Card info */}
              <div className="text-white font-bold text-base mb-0.5">{card.name}</div>
              <div className={`text-xs mb-1 capitalize ${rarityColors[rarity] || 'text-white/50'}`}>{deckTypeLabel} · {rarity}{card.draftCost > 0 ? ` · ${card.draftCost} cr` : ' · Gratuita'}</div>

              {/* PTI/Stars for personaggi */}
              {cardViewer.deckType === 'personaggi' && (card.pti != null || card.stars != null) && (
                <div className="flex items-center gap-3 mb-2">
                  {card.pti != null && (
                    <div className="text-teal-300 text-sm font-bold">
                      PTI: {card.pti + (growth?.extraPti || 0)}
                      {growth?.extraPti ? <span className="text-emerald-400 text-xs ml-1">(+{growth.extraPti})</span> : null}
                    </div>
                  )}
                  {card.stars != null && (
                    <div className="text-yellow-300 text-sm font-bold">
                      {'⭐'.repeat(Math.min(card.stars + (growth?.extraStars || 0), 7))}
                      {growth?.extraStars ? <span className="text-emerald-400 text-xs ml-1">(+{growth.extraStars})</span> : null}
                    </div>
                  )}
                </div>
              )}
              {growth && (growth.extraPti > 0 || growth.extraStars > 0) && (
                <div className="text-emerald-400 text-xs mb-2 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-2 py-1">
                  🌱 Crescita: {growth.extraPti > 0 ? `+${growth.extraPti} PTI` : ''}{growth.extraPti > 0 && growth.extraStars > 0 ? ', ' : ''}{growth.extraStars > 0 ? `+${growth.extraStars} ⭐` : ''}
                </div>
              )}

              {/* Sell section */}
              <div className="w-full bg-black/30 rounded-xl border border-white/10 p-3 mb-3">
                <div className="text-white/40 text-[10px] mb-1.5">Prezzo di vendita (crediti)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} value={cvSellPrice}
                    onChange={e => setCvSellPrice(parseInt(e.target.value) || 0)}
                    className="flex-1 px-2 py-1.5 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-amber-400/50"
                  />
                  <button
                    onClick={handleCardViewerSell}
                    disabled={cvSelling || cvSellPrice <= 0}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-lg text-xs disabled:opacity-50 transition-all"
                  >
                    {cvSelling ? '...' : 'Vendi'}
                  </button>
                </div>
                {cvSellMsg && (
                  <div className={`mt-1.5 text-xs ${cvSellMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{cvSellMsg.text}</div>
                )}
              </div>

              {/* Elimina button */}
              <button
                onClick={() => { removeCard(card.id, cardViewer.deckType); setCardViewer(null); }}
                className="w-full py-2.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded-xl text-red-300 font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Minus className="w-4 h-4" />Elimina dal mazzo
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
