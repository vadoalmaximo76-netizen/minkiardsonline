import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Tag, Filter, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketplaceProps {
  userId: number;
  username: string;
  onClose: () => void;
  preloadedCollection?: UserCard[];
}

interface Listing {
  id: number;
  sellerId: number;
  sellerName: string;
  cardId: string;
  cardName: string;
  cardType: string;
  cardRarity: string;
  cardImageUrl?: string;
  priceCredits: number;
  cardPti?: number | null;
  cardStars?: number | null;
  originalCost?: number | null;
  createdAt: string;
}

interface UserCard {
  cardId: string;
  cardName: string;
  cardType: string;
  cardRarity: string;
  cardImageUrl?: string;
  count: number;
  pti?: number | null;
  stars?: number | null;
  draftCost?: number;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function getRarityColor(rarity: string) {
  switch ((rarity || '').toLowerCase()) {
    case "leggendaria": return "bg-yellow-500 border-yellow-400 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]";
    case "epica": return "bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]";
    case "rara": return "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]";
    default: return "bg-gray-500 border-gray-400 text-white";
  }
}

async function fetchUserCollection(): Promise<UserCard[]> {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' }
    : { 'Cache-Control': 'no-cache' };

  const [collectionRes, cardsRes] = await Promise.all([
    fetch("/api/draft/collection", { headers, cache: 'no-store' }),
    fetch("/api/draft/cards", { cache: 'no-store' }),
  ]);

  if (!collectionRes.ok) {
    console.warn('[Marketplace] /api/draft/collection returned', collectionRes.status);
    return [];
  }

  const collData: Array<{ cardId: string; deckType: string; rarity: string }> = await collectionRes.json();
  const cardsData: Array<{ id: string; name: string; deckType: string; imageUrl?: string }> = cardsRes.ok
    ? await cardsRes.json()
    : [];

  const cardMap = new Map(cardsData.map((c: any) => [c.id, c]));

  return collData.map(item => {
    const meta = cardMap.get(item.cardId) as any;
    return {
      cardId: item.cardId,
      cardName: meta?.name || item.cardId,
      cardType: item.deckType || meta?.deckType || '',
      cardRarity: item.rarity || 'comune',
      cardImageUrl: meta?.imageUrl,
      pti: meta?.pti ?? null,
      stars: meta?.stars ?? null,
      draftCost: meta?.draftCost ?? 0,
      count: 1,
    };
  });
}

interface SellTabContentProps {
  onListSuccess: () => void;
}

function SellTabContent({ onListSuccess }: SellTabContentProps) {
  const [collection, setCollection] = React.useState<UserCard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [debugMsg, setDebugMsg] = React.useState('avvio...');
  const [selectedCard, setSelectedCard] = React.useState<string | null>(null);
  const [price, setPrice] = React.useState(50);
  const { toast } = useToast();

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setDebugMsg('fetch in corso...');
    try {
      const cards = await fetchUserCollection();
      setCollection(cards);
      setDebugMsg(`caricato: ${cards.length} carte`);
    } catch (e: any) {
      setDebugMsg(`errore: ${e?.message || e}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const listMutation = useMutation({
    mutationFn: async (data: { cardId: string; cardName: string; cardType: string; cardRarity: string; cardImageUrl?: string; priceCredits: number; cardPti?: number | null; cardStars?: number | null; originalCost?: number | null }) => {
      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Errore creazione annuncio"); }
    },
    onSuccess: () => {
      toast({ title: "Annuncio creato", description: "La tua carta è ora in vendita nel marketplace." });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      setSelectedCard(null);
      setPrice(50);
      onListSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Errore nella creazione dell'annuncio", description: error.message, variant: "destructive" });
    },
  });

  const card = collection.find(c => c.cardId === selectedCard);

  return (
    <div className="p-6 pt-2 flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">
              Seleziona una carta ({isLoading ? <span className="text-yellow-400">caricamento...</span> : <span className="text-green-400 font-bold">{collection.length}</span>} disponibili)
            </h3>
            <Button variant="ghost" size="sm" onClick={load} disabled={isLoading} className="gap-1 text-xs text-slate-400 hover:text-white">
              <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> Ricarica
            </Button>
          </div>
          <div className="text-[10px] text-slate-600">{debugMsg}</div>
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <span className="ml-3 text-slate-400 text-sm">Caricamento collezione...</span>
              </div>
            ) : collection.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                <p>Non hai carte nella tua collezione.</p>
                <p className="text-xs mt-1 text-slate-600">Apri pacchetti nel tab "Pacchetti" per ottenere carte.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                {collection.map((c) => (
                  <div
                    key={c.cardId}
                    onClick={() => setSelectedCard(c.cardId)}
                    className={cn(
                      "p-2 rounded-lg border-2 cursor-pointer transition-all",
                      selectedCard === c.cardId
                        ? "bg-purple-500/20 border-purple-500"
                        : "bg-black/40 border-transparent hover:border-white/20"
                    )}
                  >
                    <div className="aspect-[3/4] bg-slate-800 rounded mb-2 overflow-hidden relative">
                      {c.cardImageUrl && <img src={c.cardImageUrl} className="w-full h-full object-cover" alt={c.cardName} />}
                    </div>
                    <div className="text-xs font-bold truncate">{c.cardName}</div>
                    <Badge className={cn("text-[10px] h-4 mt-1 px-1", getRarityColor(c.cardRarity || "comune"))}>
                      {c.cardRarity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-72 bg-white/5 rounded-lg border border-white/10 p-6 flex flex-col gap-6 justify-center">
          {card && (
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">Carta selezionata</div>
              <div className="font-bold text-sm truncate">{card.cardName}</div>
              <Badge className={cn("text-[10px] mt-1", getRarityColor(card.cardRarity || "comune"))}>{card.cardRarity}</Badge>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Prezzo (crediti)</label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                className="bg-black/40 border-white/20"
              />
              <span className="text-yellow-400 font-bold text-sm">CR</span>
            </div>
          </div>
          <Button
            className="w-full h-12 text-base"
            disabled={!selectedCard || price <= 0 || listMutation.isPending}
            onClick={() => {
              if (!selectedCard || !card) return;
              listMutation.mutate({
                cardId: card.cardId,
                cardName: card.cardName,
                cardType: card.cardType,
                cardRarity: card.cardRarity,
                cardImageUrl: card.cardImageUrl,
                priceCredits: price,
                cardPti: card.pti ?? null,
                cardStars: card.stars ?? null,
                originalCost: card.draftCost ?? null,
              });
            }}
          >
            {listMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Tag className="w-5 h-5 mr-2" />}
            Metti in vendita
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Marketplace({ userId, username, onClose }: MarketplaceProps) {
  const [activeTab, setActiveTab] = React.useState("explore");
  const [filterType, setFilterType] = React.useState<string>("ALL");
  const [filterRarity, setFilterRarity] = React.useState<string>("ALL");
  const [purchaseConfirm, setPurchaseConfirm] = React.useState<Listing | null>(null);
  const [myListings, setMyListings] = React.useState<Listing[]>([]);
  const [isLoadingMyListings, setIsLoadingMyListings] = React.useState(false);
  const { toast } = useToast();

  const { data: listings = [], isLoading: isLoadingListings } = useQuery<Listing[]>({
    queryKey: ["/api/marketplace", filterType, filterRarity],
    queryFn: async () => {
      let url = "/api/marketplace";
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.append("type", filterType);
      if (filterRarity !== "ALL") params.append("rarity", filterRarity);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
  });

  const loadMyListings = React.useCallback(async () => {
    setIsLoadingMyListings(true);
    try {
      const res = await fetch("/api/marketplace/mine", { headers: getAuthHeaders() });
      if (res.ok) setMyListings(await res.json());
    } catch (_) {}
    finally { setIsLoadingMyListings(false); }
  }, []);

  React.useEffect(() => {
    if (activeTab === "mine") loadMyListings();
  }, [activeTab, loadMyListings]);

  const buyMutation = useMutation({
    mutationFn: async (listingId: number) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/marketplace/buy/${listingId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Errore acquisto"); }
    },
    onSuccess: () => {
      toast({ title: "Acquisto completato!", description: "La carta è stata aggiunta alla tua collezione." });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      setPurchaseConfirm(null);
    },
    onError: (error: Error) => {
      toast({ title: "Errore durante l'acquisto", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (listingId: number) => {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/marketplace/${listingId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Errore rimozione"); }
    },
    onSuccess: () => {
      toast({ title: "Annuncio rimosso", description: "La carta è tornata nella tua collezione." });
      loadMyListings();
    },
  });

  const filteredExploreListings = listings.filter(l => l.sellerId !== userId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] bg-black/80 backdrop-blur-xl border-purple-500/30 text-white flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-2">
            <Tag className="w-6 h-6" /> Marketplace
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-white/10">
            <TabsList className="bg-white/5 border border-white/10 mb-4">
              <TabsTrigger value="explore">Esplora</TabsTrigger>
              <TabsTrigger value="mine">I miei annunci</TabsTrigger>
              <TabsTrigger value="sell">Vendi</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="explore" className="m-0 p-6 pt-2 flex flex-col gap-4">
              <div className="flex flex-wrap gap-4 items-center bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">Filtri:</span>
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[150px] bg-black/40 border-white/20">
                    <SelectValue placeholder="Tipo Carta" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/20 text-white">
                    <SelectItem value="ALL">Tutti i tipi</SelectItem>
                    <SelectItem value="PERSONAGGI">Personaggi</SelectItem>
                    <SelectItem value="MOSSE">Mosse</SelectItem>
                    <SelectItem value="BONUS">Bonus</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterRarity} onValueChange={setFilterRarity}>
                  <SelectTrigger className="w-[150px] bg-black/40 border-white/20">
                    <SelectValue placeholder="Rarità" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/20 text-white">
                    <SelectItem value="ALL">Tutte le rarità</SelectItem>
                    <SelectItem value="comune">Comune</SelectItem>
                    <SelectItem value="rara">Rara</SelectItem>
                    <SelectItem value="epica">Epica</SelectItem>
                    <SelectItem value="leggendaria">Leggendaria</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="flex-1">
                {isLoadingListings ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : filteredExploreListings.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    Nessun annuncio trovato con i filtri selezionati.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                    {filteredExploreListings.map((listing) => (
                      <Card key={listing.id} className="bg-white/5 border-white/10 overflow-hidden hover:border-purple-500/50 transition-colors">
                        <CardHeader className="p-3 pb-2">
                          <div className="aspect-[3/4] rounded-md bg-slate-800 relative mb-2 overflow-hidden">
                            {listing.cardImageUrl ? (
                              <img src={listing.cardImageUrl} alt={listing.cardName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">No Image</div>
                            )}
                            <Badge className={cn("absolute top-2 right-2", getRarityColor(listing.cardRarity))}>
                              {listing.cardRarity}
                            </Badge>
                          </div>
                          <CardTitle className="text-sm font-bold truncate">{listing.cardName}</CardTitle>
                          <p className="text-xs text-slate-500">{listing.cardType} • da {listing.sellerName}</p>
                          {listing.cardType === 'personaggi' && (listing.cardPti != null || listing.cardStars != null) && (
                            <div className="flex items-center gap-2 mt-1">
                              {listing.cardPti != null && (
                                <span className="text-teal-300 text-xs font-bold">PTI {listing.cardPti}</span>
                              )}
                              {listing.cardStars != null && listing.cardStars > 0 && (
                                <span className="text-yellow-300 text-xs font-bold">{'⭐'.repeat(Math.min(listing.cardStars, 7))}</span>
                              )}
                            </div>
                          )}
                        </CardHeader>
                        <CardFooter className="p-3 pt-1 flex justify-between items-center">
                          <div className="flex flex-col">
                            {listing.originalCost != null && listing.originalCost > listing.priceCredits && (
                              <span className="text-slate-500 text-[10px] line-through leading-none mb-0.5">{listing.originalCost} cr</span>
                            )}
                            <span className="text-yellow-400 font-bold flex items-center gap-1 text-sm">
                              {listing.priceCredits} <span className="text-[10px]">CR</span>
                            </span>
                          </div>
                          <Button size="sm" onClick={() => setPurchaseConfirm(listing)} className="bg-purple-600 hover:bg-purple-500 border-none">
                            Acquista
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="mine" className="m-0 p-6 pt-2">
              <ScrollArea>
                {isLoadingMyListings ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : myListings.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                    Non hai annunci attivi.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
                    {myListings.map((listing) => (
                      <Card key={listing.id} className="bg-white/5 border-white/10 overflow-hidden border-blue-500/30">
                        <CardHeader className="p-3 pb-2">
                          <div className="aspect-[3/4] rounded-md bg-slate-800 relative mb-2 overflow-hidden">
                            {listing.cardImageUrl && <img src={listing.cardImageUrl} className="w-full h-full object-cover" />}
                            <Badge className={cn("absolute top-2 right-2", getRarityColor(listing.cardRarity))}>
                              {listing.cardRarity}
                            </Badge>
                          </div>
                          <CardTitle className="text-sm font-bold truncate">{listing.cardName}</CardTitle>
                          <p className="text-xs text-slate-500">{listing.cardType}</p>
                          {listing.cardType === 'personaggi' && (listing.cardPti != null || listing.cardStars != null) && (
                            <div className="flex items-center gap-2 mt-1">
                              {listing.cardPti != null && (
                                <span className="text-teal-300 text-xs font-bold">PTI {listing.cardPti}</span>
                              )}
                              {listing.cardStars != null && listing.cardStars > 0 && (
                                <span className="text-yellow-300 text-xs font-bold">{'⭐'.repeat(Math.min(listing.cardStars, 7))}</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {listing.originalCost != null && listing.originalCost > listing.priceCredits && (
                              <span className="text-slate-500 text-xs line-through">{listing.originalCost} cr</span>
                            )}
                            <span className="text-yellow-400 font-bold text-sm">{listing.priceCredits} <span className="text-[10px] font-normal">CR</span></span>
                          </div>
                        </CardHeader>
                        <CardFooter className="p-3 pt-0">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => cancelMutation.mutate(listing.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" /> Rimuovi Annuncio
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sell" className="m-0">
              <SellTabContent
                onListSuccess={() => {
                  loadMyListings();
                  setActiveTab("mine");
                }}
              />
            </TabsContent>
          </div>
        </Tabs>

        <Dialog open={!!purchaseConfirm} onOpenChange={(open) => !open && setPurchaseConfirm(null)}>
          <DialogContent className="bg-slate-900 border-white/20 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle>Conferma Acquisto</DialogTitle>
              <DialogDescription className="text-slate-400">
                Sei sicuro di voler acquistare <strong>{purchaseConfirm?.cardName}</strong> per <span className="text-yellow-400 font-bold">{purchaseConfirm?.priceCredits} crediti</span>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setPurchaseConfirm(null)}>Annulla</Button>
              <Button
                onClick={() => purchaseConfirm && buyMutation.mutate(purchaseConfirm.id)}
                disabled={buyMutation.isPending}
                className="bg-green-600 hover:bg-green-500 border-none"
              >
                {buyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Conferma e paga
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
