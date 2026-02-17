import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import { CARD_DATA } from "../lib/cardData";

interface CollectionPanelProps {
  visible: boolean;
  onClose: () => void;
}

interface CollectedCard {
  id: number;
  userId: number;
  cardName: string;
  cardDeckType: string;
  cardImageUrl: string;
  timesDrawn: number;
  firstDrawnAt: string;
  lastDrawnAt: string;
}

interface CollectionStats {
  total: number;
  totalCards: number;
  completionPercent: number;
  byType: Record<string, { collected: number; total: number }>;
  badges: string[];
}

type DeckTab = "personaggi" | "mosse" | "bonus" | "personaggi_speciali";

const TAB_LABELS: Record<DeckTab, string> = {
  personaggi: "PERSONAGGI",
  mosse: "MOSSE",
  bonus: "BONUS",
  personaggi_speciali: "PERSONAGGI SPECIALI",
};

const TABS: DeckTab[] = ["personaggi", "mosse", "bonus", "personaggi_speciali"];

const BADGE_MAP: Record<string, string> = {
  collector_10: "🎴 Collezionista Novizio",
  collector_50: "📚 Collezionista Esperto",
  collector_100: "🏆 Collezionista Maestro",
  collector_200: "👑 Collezionista Leggendario",
  complete_personaggi: "⭐ Tutti i Personaggi",
  complete_mosse: "⚔️ Tutte le Mosse",
  complete_bonus: "🎁 Tutti i Bonus",
  complete_personaggi_speciali: "💎 Tutti i Personaggi Speciali",
};

function extractCardName(url: string): string {
  const lastSegment = url.split("/").pop() || "";
  const withoutExt = lastSegment.replace(/\.[^.]+$/, "");
  return withoutExt.replace(/-/g, " ");
}

export const CollectionPanel: React.FC<CollectionPanelProps> = ({ visible, onClose }) => {
  const [activeTab, setActiveTab] = useState<DeckTab>("personaggi");
  const [collection, setCollection] = useState<CollectedCard[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      const token = localStorage.getItem("minkiards_token");
      if (!token) {
        setLoading(false);
        setError("Accedi per vedere la tua collezione");
        return;
      }

      setLoading(true);
      setError(null);

      Promise.all([
        fetch("/api/collection", {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject("Errore caricamento collezione"))),
        fetch("/api/collection/stats", {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => (r.ok ? r.json() : Promise.reject("Errore caricamento statistiche"))),
      ])
        .then(([collectionData, statsData]) => {
          setCollection(collectionData);
          setStats(statsData);
        })
        .catch((err) => {
          setError(typeof err === "string" ? err : "Errore di connessione");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible]);

  const collectedMap = useMemo(() => {
    const map = new Map<string, CollectedCard>();
    collection.forEach((card) => {
      map.set(card.cardImageUrl, card);
    });
    return map;
  }, [collection]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  if (!visible) return null;

  const currentCards = CARD_DATA[activeTab] || [];
  const byType = stats?.byType || {};
  const completionPercent = stats?.completionPercent || 0;

  const progressColor =
    completionPercent < 25
      ? "from-red-500 to-red-400"
      : completionPercent < 50
        ? "from-orange-500 to-yellow-400"
        : completionPercent < 75
          ? "from-yellow-400 to-green-400"
          : "from-green-400 to-emerald-400";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />

      <div
        className={`relative max-w-lg w-full h-full bg-black/60 backdrop-blur-xl border-r border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isClosing ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">📖 Collezione Carte</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-white/60 text-center px-4">
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">Completamento</span>
                <span className="text-white font-bold">
                  {stats?.total || 0} / {stats?.totalCards || 0} carte trovate ({Math.round(completionPercent)}%)
                </span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-500`}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {TABS.map((tab) => {
                  const typeStats = byType[tab];
                  return (
                    <span key={tab} className="text-white/50">
                      {TAB_LABELS[tab]}: {typeStats?.collected || 0}/{typeStats?.total || 0}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 p-3 overflow-x-auto border-b border-white/10 scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab
                      ? "bg-amber-500 text-black"
                      : "bg-white/10 text-white/60 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {currentCards.map((url) => {
                  const collected = collectedMap.get(url);
                  const name = extractCardName(url);
                  return (
                    <div key={url} className="relative group">
                      <div
                        className={`rounded-lg overflow-hidden border-2 transition-all ${
                          collected
                            ? "border-amber-400/70 shadow-md shadow-amber-400/20"
                            : "border-gray-600/50"
                        }`}
                      >
                        <img
                          src={url}
                          alt={name}
                          loading="lazy"
                          className={`w-full aspect-[3/4] object-cover ${
                            collected ? "" : "brightness-[0.1]"
                          }`}
                        />
                      </div>
                      {collected && collected.timesDrawn > 0 && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black border-2 border-black/50">
                          {collected.timesDrawn}
                        </div>
                      )}
                      <p className="text-[9px] text-white/50 text-center mt-1 truncate leading-tight">
                        {name}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {stats?.badges && stats.badges.length > 0 && (
              <div className="p-3 border-t border-white/10">
                <p className="text-xs text-white/50 mb-2 font-semibold">🏅 Badge Ottenuti</p>
                <div className="flex flex-wrap gap-2">
                  {stats.badges.map((badge) => (
                    <span
                      key={badge}
                      className="px-2 py-1 bg-white/10 rounded-full text-xs text-white/80"
                    >
                      {BADGE_MAP[badge] || badge}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
