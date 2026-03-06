import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, Trash2, Tag, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketplaceProps {
  userId: number;
  username: string;
  onClose: () => void;
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
  createdAt: string;
}

interface UserCard {
  cardId: string;
  cardName: string;
  cardType: string;
  cardRarity: string;
  cardImageUrl?: string;
  count: number;
}

export function Marketplace({ userId, username, onClose }: MarketplaceProps) {
  const [activeTab, setActiveTab] = React.useState("explore");
  const [filterType, setFilterType] = React.useState<string>("ALL");
  const [filterRarity, setFilterRarity] = React.useState<string>("ALL");
  const [purchaseConfirm, setPurchaseConfirm] = React.useState<Listing | null>(null);
  const [sellPrice, setSellPrice] = React.useState<number>(50);
  const [selectedCardForSale, setSelectedCardForSale] = React.useState<string | null>(null);
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

  const { data: myListings = [], isLoading: isLoadingMyListings } = useQuery<Listing[]>({
    queryKey: ["/api/marketplace/mine"],
    enabled: activeTab === "mine",
  });

  const { data: myCollection = [], isLoading: isLoadingCollection } = useQuery<UserCard[]>({
    queryKey: ["/api/user/collection"],
    enabled: activeTab === "sell",
  });

  const buyMutation = useMutation({
    mutationFn: async (listingId: number) => {
      await apiRequest("POST", `/api/marketplace/buy/${listingId}`);
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
      await apiRequest("DELETE", `/api/marketplace/${listingId}`);
    },
    onSuccess: () => {
      toast({ title: "Annuncio rimosso", description: "La carta è tornata nella tua collezione." });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/mine"] });
    },
  });

  const listMutation = useMutation({
    mutationFn: async (data: { cardId: string; price: number }) => {
      await apiRequest("POST", "/api/marketplace/list", data);
    },
    onSuccess: () => {
      toast({ title: "Annuncio creato", description: "La tua carta è ora in vendita nel marketplace." });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/collection"] });
      setSelectedCardForSale(null);
      setSellPrice(50);
      setActiveTab("mine");
    },
    onError: (error: Error) => {
      toast({ title: "Errore nella creazione dell'annuncio", description: error.message, variant: "destructive" });
    },
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case "leggendaria": return "bg-yellow-500 border-yellow-400 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]";
      case "epica": return "bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]";
      case "rara": return "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]";
      default: return "bg-gray-500 border-gray-400 text-white";
    }
  };

  const filteredExploreListings = listings.filter(l => l.sellerId !== userId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] bg-black/80 backdrop-blur-xl border-purple-500/30 text-white flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 flex items-center gap-2">
            <Tag className="w-6 h-6" /> Marketplace
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 border-b border-white/10">
            <TabsList className="bg-white/5 border border-white/10 mb-4">
              <TabsTrigger value="explore">Esplora</TabsTrigger>
              <TabsTrigger value="mine">I miei annunci</TabsTrigger>
              <TabsTrigger value="sell">Vendi</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="explore" className="h-full m-0 p-6 pt-2 flex flex-col gap-4">
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
                        <CardHeader className="p-3">
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
                          <p className="text-xs text-slate-400">{listing.cardType} • Venduto da {listing.sellerName}</p>
                        </CardHeader>
                        <CardFooter className="p-3 pt-0 flex justify-between items-center">
                          <span className="text-yellow-400 font-bold flex items-center gap-1">
                            {listing.priceCredits} <span className="text-[10px]">CREDITI</span>
                          </span>
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

            <TabsContent value="mine" className="h-full m-0 p-6 pt-2">
              <ScrollArea className="h-full">
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
                        <CardHeader className="p-3">
                          <div className="aspect-[3/4] rounded-md bg-slate-800 relative mb-2 overflow-hidden">
                            {listing.cardImageUrl && <img src={listing.cardImageUrl} className="w-full h-full object-cover" />}
                            <Badge className={cn("absolute top-2 right-2", getRarityColor(listing.cardRarity))}>
                              {listing.cardRarity}
                            </Badge>
                          </div>
                          <CardTitle className="text-sm font-bold truncate">{listing.cardName}</CardTitle>
                          <p className="text-xs text-slate-400">{listing.cardType} • In vendita per {listing.priceCredits} crediti</p>
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

            <TabsContent value="sell" className="h-full m-0 p-6 pt-2 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
                <div className="flex flex-col gap-4 overflow-hidden">
                  <h3 className="text-sm font-medium text-slate-400">Seleziona una carta (devi avere almeno un doppione)</h3>
                  <ScrollArea className="flex-1 bg-white/5 rounded-lg border border-white/10 p-4">
                    {isLoadingCollection ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {myCollection.filter(c => c.count > 1).map((card) => (
                          <div 
                            key={card.cardId}
                            onClick={() => setSelectedCardForSale(card.cardId)}
                            className={cn(
                              "p-2 rounded-lg border-2 cursor-pointer transition-all",
                              selectedCardForSale === card.cardId 
                                ? "bg-purple-500/20 border-purple-500" 
                                : "bg-black/40 border-transparent hover:border-white/20"
                            )}
                          >
                            <div className="aspect-[3/4] bg-slate-800 rounded mb-2 overflow-hidden relative">
                              {card.cardImageUrl && <img src={card.cardImageUrl} className="w-full h-full object-cover" />}
                              <Badge className="absolute top-1 right-1 h-5 px-1 bg-black/60">x{card.count}</Badge>
                            </div>
                            <div className="text-xs font-bold truncate">{card.cardName}</div>
                            <Badge className={cn("text-[10px] h-4 mt-1 px-1", getRarityColor(card.cardRarity || "comune"))}>
                              {card.cardRarity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    {!isLoadingCollection && myCollection.filter(c => c.count > 1).length === 0 && (
                      <div className="text-center py-10 text-slate-500 text-sm">
                        Non hai carte duplicabili in vendita.
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="bg-white/5 rounded-lg border border-white/10 p-6 flex flex-col gap-6 justify-center">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Prezzo di vendita (50 - 5000 crediti)</label>
                      <div className="flex items-center gap-3">
                        <Input 
                          type="number" 
                          min={50} 
                          max={5000} 
                          value={sellPrice}
                          onChange={(e) => setSellPrice(parseInt(e.target.value) || 0)}
                          className="bg-black/40 border-white/20"
                        />
                        <span className="text-yellow-400 font-bold">CREDITI</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-12 text-lg" 
                    disabled={!selectedCardForSale || sellPrice < 50 || sellPrice > 5000 || listMutation.isPending}
                    onClick={() => selectedCardForSale && listMutation.mutate({ cardId: selectedCardForSale, price: sellPrice })}
                  >
                    {listMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Tag className="w-5 h-5 mr-2" />}
                    Metti in vendita
                  </Button>
                </div>
              </div>
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
