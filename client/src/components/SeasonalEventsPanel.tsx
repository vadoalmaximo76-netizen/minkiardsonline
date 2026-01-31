import React, { useState, useEffect } from 'react';
import { X, Calendar, Sparkles, Gift, Clock, Star, Zap } from 'lucide-react';

interface SeasonalEvent {
  id: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  bannerImage: string | null;
  isActive: boolean;
}

interface SeasonalCard {
  id: number;
  eventId: number;
  name: string;
  deckType: string;
  imageUrl: string | null;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  rarity: string;
}

interface SeasonalEventsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SeasonalEventsPanel({ isOpen, onClose }: SeasonalEventsPanelProps) {
  const [events, setEvents] = useState<SeasonalEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SeasonalEvent | null>(null);
  const [cards, setCards] = useState<SeasonalCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seasonal-events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
        if (data.events.length > 0) {
          const activeEvent = data.events.find((e: SeasonalEvent) => e.isActive);
          if (activeEvent) {
            handleEventSelect(activeEvent);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch seasonal events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventSelect = async (event: SeasonalEvent) => {
    setSelectedEvent(event);
    try {
      const res = await fetch(`/api/seasonal-events/${event.id}/cards`);
      const data = await res.json();
      if (data.success) {
        setCards(data.cards);
      }
    } catch (error) {
      console.error('Failed to fetch seasonal cards:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500';
      case 'epic': return 'from-purple-400 to-pink-500';
      case 'rare': return 'from-blue-400 to-cyan-500';
      default: return 'from-gray-400 to-slate-500';
    }
  };

  const getDeckTypeIcon = (deckType: string) => {
    switch (deckType) {
      case 'personaggi': return '👤';
      case 'mosse': return '⚔️';
      case 'bonus': return '🎁';
      case 'personaggi_speciali': return '⭐';
      default: return '🃏';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-600">
        <div className="flex items-center justify-between p-4 border-b border-slate-600 bg-gradient-to-r from-pink-600 via-red-600 to-orange-600">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            Eventi Stagionali
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          <div className="w-1/3 border-r border-slate-600 overflow-y-auto">
            <div className="p-3 bg-slate-800/50 border-b border-slate-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Eventi Attivi e Passati
              </h3>
            </div>

            {loading && (
              <div className="p-8 text-center text-slate-400">
                Caricamento...
              </div>
            )}

            {!loading && events.length === 0 && (
              <div className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-pink-400 opacity-50" />
                <p className="text-slate-400">Nessun evento stagionale attivo</p>
                <p className="text-slate-500 text-sm mt-2">Torna presto per nuovi eventi!</p>
              </div>
            )}

            {events.map(event => (
              <button
                key={event.id}
                onClick={() => handleEventSelect(event)}
                className={`w-full p-4 text-left border-b border-slate-700 transition-colors ${
                  selectedEvent?.id === event.id ? 'bg-pink-900/50' : 'hover:bg-slate-700'
                } ${!event.isActive ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {event.isActive ? (
                    <Zap className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-white font-medium text-sm truncate">
                    {event.name}
                  </span>
                </div>
                {event.description && (
                  <p className="text-slate-400 text-xs mb-2 line-clamp-2">
                    {event.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs">
                  {event.isActive ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getDaysRemaining(event.endDate)} giorni rimasti
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full">
                      Terminato
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col">
            {!selectedEvent ? (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Gift className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Seleziona un evento per vedere le carte speciali</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-slate-600 bg-gradient-to-r from-pink-900/50 to-orange-900/50">
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    {selectedEvent.name}
                  </h3>
                  {selectedEvent.description && (
                    <p className="text-slate-300 text-sm mb-2">{selectedEvent.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>Dal {formatDate(selectedEvent.startDate)}</span>
                    <span>al {formatDate(selectedEvent.endDate)}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-pink-400" />
                    Carte Esclusive ({cards.length})
                  </h4>

                  {cards.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <p>Nessuna carta esclusiva per questo evento</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {cards.map(card => (
                        <div
                          key={card.id}
                          className={`bg-gradient-to-b ${getRarityColor(card.rarity)} p-1 rounded-xl`}
                        >
                          <div className="bg-slate-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-2xl">{getDeckTypeIcon(card.deckType)}</span>
                              <span className="text-xs text-slate-400 capitalize">{card.rarity}</span>
                            </div>
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl}
                                alt={card.name}
                                className="w-full h-24 object-cover rounded-lg mb-2"
                              />
                            ) : (
                              <div className="w-full h-24 bg-gradient-to-br from-pink-600 to-orange-600 rounded-lg mb-2 flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-white" />
                              </div>
                            )}
                            <h5 className="text-white font-bold text-sm truncate">{card.name}</h5>
                            <div className="flex items-center justify-between mt-2 text-xs">
                              {card.pti && (
                                <span className="text-red-400">PTI: {card.pti}</span>
                              )}
                              {card.stars && (
                                <span className="text-yellow-400 flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  {card.stars}
                                </span>
                              )}
                            </div>
                            {card.effect && (
                              <p className="text-slate-400 text-xs mt-2 line-clamp-2">
                                {card.effect}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
