import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, Calendar, Image, Crown, Sparkles, Star } from 'lucide-react';

interface SeasonalEvent {
  id: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  bannerImage: string | null;
  isActive: boolean;
  createdAt: string;
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

interface AdminEventsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

const DECK_OPTIONS = [
  { value: 'PERSONAGGI', label: 'Personaggi' },
  { value: 'MOSSE', label: 'Mosse' },
  { value: 'BONUS', label: 'Bonus' },
  { value: 'PERSONAGGI_SPECIALI', label: 'Personaggi Speciali' }
];

const RARITY_OPTIONS = [
  { value: 'common', label: 'Comune', color: 'gray' },
  { value: 'rare', label: 'Rara', color: 'blue' },
  { value: 'epic', label: 'Epica', color: 'purple' },
  { value: 'legendary', label: 'Leggendaria', color: 'amber' }
];

export function AdminEventsPanel({ isOpen, onClose, authToken }: AdminEventsPanelProps) {
  const [events, setEvents] = useState<SeasonalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SeasonalEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SeasonalEvent | null>(null);
  const [eventCards, setEventCards] = useState<SeasonalCard[]>([]);
  const [eventFormData, setEventFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    bannerImage: '',
    isActive: true
  });
  const [cardFormData, setCardFormData] = useState({
    name: '',
    deckType: 'PERSONAGGI',
    imageUrl: '',
    pti: '',
    stars: '',
    effect: '',
    rarity: 'rare'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && authToken) {
      fetchEvents();
    }
  }, [isOpen, authToken]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seasonal-events');
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventCards = async (eventId: number) => {
    try {
      const res = await fetch(`/api/seasonal-events/${eventId}/cards`);
      const data = await res.json();
      if (data.success) {
        setEventCards(data.cards);
      }
    } catch (error) {
      console.error('Failed to fetch event cards:', error);
    }
  };

  const handleSaveEvent = async () => {
    if (!eventFormData.name || !eventFormData.startDate || !eventFormData.endDate) {
      setError('Nome, data inizio e data fine sono obbligatori');
      return;
    }

    try {
      const url = editingEvent 
        ? `/api/admin/seasonal-events/${editingEvent.id}`
        : '/api/admin/seasonal-events';
      
      const res = await fetch(url, {
        method: editingEvent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(eventFormData)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(editingEvent ? 'Evento aggiornato!' : 'Evento creato!');
        setShowEventForm(false);
        setEditingEvent(null);
        resetEventForm();
        fetchEvents();
      } else {
        setError(data.error || 'Errore nel salvare l\'evento');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo evento e tutte le sue carte?')) return;

    try {
      const res = await fetch(`/api/admin/seasonal-events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Evento eliminato!');
        fetchEvents();
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(null);
          setEventCards([]);
        }
      } else {
        setError(data.error || 'Errore nell\'eliminare l\'evento');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleSaveCard = async () => {
    if (!selectedEvent || !cardFormData.name || !cardFormData.deckType) {
      setError('Nome e tipo mazzo sono obbligatori');
      return;
    }

    try {
      const res = await fetch(`/api/admin/seasonal-events/${selectedEvent.id}/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ...cardFormData,
          pti: cardFormData.pti ? parseInt(cardFormData.pti) : null,
          stars: cardFormData.stars ? parseInt(cardFormData.stars) : null
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Carta aggiunta!');
        setShowCardForm(false);
        resetCardForm();
        fetchEventCards(selectedEvent.id);
      } else {
        setError(data.error || 'Errore nell\'aggiungere la carta');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa carta?')) return;

    try {
      const res = await fetch(`/api/admin/seasonal-cards/${cardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Carta eliminata!');
        if (selectedEvent) {
          fetchEventCards(selectedEvent.id);
        }
      } else {
        setError(data.error || 'Errore nell\'eliminare la carta');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const resetEventForm = () => {
    setEventFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      bannerImage: '',
      isActive: true
    });
  };

  const resetCardForm = () => {
    setCardFormData({
      name: '',
      deckType: 'PERSONAGGI',
      imageUrl: '',
      pti: '',
      stars: '',
      effect: '',
      rarity: 'rare'
    });
  };

  const openEditEvent = (event: SeasonalEvent) => {
    setEditingEvent(event);
    setEventFormData({
      name: event.name,
      description: event.description || '',
      startDate: event.startDate.split('T')[0],
      endDate: event.endDate.split('T')[0],
      bannerImage: event.bannerImage || '',
      isActive: event.isActive
    });
    setShowEventForm(true);
  };

  const openEventCards = (event: SeasonalEvent) => {
    setSelectedEvent(event);
    fetchEventCards(event.id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-amber-400';
      case 'epic': return 'text-purple-400';
      case 'rare': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 to-purple-950 rounded-xl border border-purple-500/30 w-full max-w-5xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-purple-500/30">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-400" />
            Gestione Eventi Stagionali
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
            {success}
          </div>
        )}

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!selectedEvent ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-purple-300">Eventi</h3>
                <button
                  onClick={() => { setShowEventForm(true); setEditingEvent(null); resetEventForm(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuovo Evento
                </button>
              </div>

              {showEventForm && (
                <div className="mb-6 p-4 bg-purple-800/30 rounded-lg border border-purple-500/30">
                  <h4 className="text-md font-semibold text-white mb-4">
                    {editingEvent ? 'Modifica Evento' : 'Crea Nuovo Evento'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Nome *</label>
                      <input
                        type="text"
                        value={eventFormData.name}
                        onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                        placeholder="Es: Evento Natale 2026"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Banner URL</label>
                      <input
                        type="text"
                        value={eventFormData.bannerImage}
                        onChange={(e) => setEventFormData({ ...eventFormData, bannerImage: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Data Inizio *</label>
                      <input
                        type="date"
                        value={eventFormData.startDate}
                        onChange={(e) => setEventFormData({ ...eventFormData, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Data Fine *</label>
                      <input
                        type="date"
                        value={eventFormData.endDate}
                        onChange={(e) => setEventFormData({ ...eventFormData, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-purple-300 mb-1">Descrizione</label>
                      <textarea
                        value={eventFormData.description}
                        onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white h-20"
                        placeholder="Descrizione dell'evento..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={eventFormData.isActive}
                        onChange={(e) => setEventFormData({ ...eventFormData, isActive: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="isActive" className="text-sm text-purple-300">Evento Attivo</label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSaveEvent}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Salva
                    </button>
                    <button
                      onClick={() => { setShowEventForm(false); setEditingEvent(null); resetEventForm(); }}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center text-purple-300 py-8">Caricamento...</div>
              ) : events.length === 0 ? (
                <div className="text-center text-purple-400 py-8">Nessun evento creato</div>
              ) : (
                <div className="grid gap-4">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 bg-purple-800/30 rounded-lg border border-purple-500/30 hover:border-purple-400/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-white">{event.name}</h4>
                            {event.isActive ? (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Attivo</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">Inattivo</span>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-purple-300 mt-1">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-purple-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(event.startDate)} - {formatDate(event.endDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEventCards(event)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm"
                          >
                            Carte
                          </button>
                          <button
                            onClick={() => openEditEvent(event)}
                            className="p-2 text-purple-400 hover:text-white hover:bg-purple-700/50 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <button
                    onClick={() => { setSelectedEvent(null); setEventCards([]); }}
                    className="text-purple-400 hover:text-white text-sm mb-1"
                  >
                    ← Torna agli eventi
                  </button>
                  <h3 className="text-lg font-semibold text-white">
                    Carte di: {selectedEvent.name}
                  </h3>
                </div>
                <button
                  onClick={() => { setShowCardForm(true); resetCardForm(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi Carta
                </button>
              </div>

              {showCardForm && (
                <div className="mb-6 p-4 bg-purple-800/30 rounded-lg border border-purple-500/30">
                  <h4 className="text-md font-semibold text-white mb-4">Aggiungi Carta all'Evento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Nome Carta *</label>
                      <input
                        type="text"
                        value={cardFormData.name}
                        onChange={(e) => setCardFormData({ ...cardFormData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                        placeholder="Es: Goku Ultra Instinct"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Tipo Mazzo *</label>
                      <select
                        value={cardFormData.deckType}
                        onChange={(e) => setCardFormData({ ...cardFormData, deckType: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                      >
                        {DECK_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Immagine URL</label>
                      <input
                        type="text"
                        value={cardFormData.imageUrl}
                        onChange={(e) => setCardFormData({ ...cardFormData, imageUrl: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Rarità</label>
                      <select
                        value={cardFormData.rarity}
                        onChange={(e) => setCardFormData({ ...cardFormData, rarity: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                      >
                        {RARITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">PTI</label>
                      <input
                        type="number"
                        value={cardFormData.pti}
                        onChange={(e) => setCardFormData({ ...cardFormData, pti: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Stelle</label>
                      <input
                        type="number"
                        value={cardFormData.stars}
                        onChange={(e) => setCardFormData({ ...cardFormData, stars: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white"
                        placeholder="3"
                        min="1"
                        max="7"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-purple-300 mb-1">Effetto</label>
                      <textarea
                        value={cardFormData.effect}
                        onChange={(e) => setCardFormData({ ...cardFormData, effect: e.target.value })}
                        className="w-full px-3 py-2 bg-purple-900/50 border border-purple-500/30 rounded-lg text-white h-20"
                        placeholder="Descrizione dell'effetto della carta..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSaveCard}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Aggiungi
                    </button>
                    <button
                      onClick={() => { setShowCardForm(false); resetCardForm(); }}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {eventCards.length === 0 ? (
                <div className="text-center text-purple-400 py-8">Nessuna carta in questo evento</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {eventCards.map((card) => (
                    <div
                      key={card.id}
                      className="p-4 bg-purple-800/30 rounded-lg border border-purple-500/30"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-white">{card.name}</h4>
                          <p className="text-xs text-purple-400">{card.deckType}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <span className={getRarityColor(card.rarity)}>
                              {RARITY_OPTIONS.find(r => r.value === card.rarity)?.label || card.rarity}
                            </span>
                            {card.pti && <span className="text-red-400">PTI: {card.pti}</span>}
                            {card.stars && (
                              <span className="text-yellow-400 flex items-center gap-0.5">
                                <Star className="w-3 h-3" fill="currentColor" />
                                {card.stars}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {card.imageUrl && (
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="mt-2 w-full h-32 object-cover rounded-lg"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
