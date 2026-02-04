import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Send, RefreshCw, Search, Edit2, Trash2, Plus, Bell, Image } from 'lucide-react';

interface CardModification {
  cardId: string;
  name?: string;
  effect?: string;
  pti?: number;
  stars?: number;
  mosseDamageValue?: number;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
  audioUrl?: string;
}

interface CardData {
  id: string;
  type: string;
  name: string;
  frontImage: string;
  pti?: number;
  stars?: number;
  effect?: string;
  mosseDamageValue?: number;
  mosseCanCounter?: boolean;
  mosseCanBeCountered?: boolean;
}

interface CardAdminPanelProps {
  onBack: () => void;
}

export function CardAdminPanel({ onBack }: CardAdminPanelProps) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [modifications, setModifications] = useState<CardModification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [editForm, setEditForm] = useState<CardModification | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cardVersion, setCardVersion] = useState<number>(1);
  const [updateNote, setUpdateNote] = useState('');

  useEffect(() => {
    loadCards();
    loadModifications();
    loadVersion();
  }, []);

  const loadCards = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/cards', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Error loading cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModifications = async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/card-modifications', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setModifications(data.modifications || []);
      }
    } catch (error) {
      console.error('Error loading modifications:', error);
    }
  };

  const loadVersion = async () => {
    try {
      const res = await fetch('/api/card-version');
      if (res.ok) {
        const data = await res.json();
        setCardVersion(data.version || 1);
      }
    } catch (error) {
      console.error('Error loading version:', error);
    }
  };

  const handleSelectCard = (card: CardData) => {
    setSelectedCard(card);
    const existing = modifications.find(m => m.cardId === card.id);
    setEditForm({
      cardId: card.id,
      name: existing?.name || card.name || '',
      effect: existing?.effect || card.effect || '',
      pti: existing?.pti || card.pti,
      stars: existing?.stars || card.stars,
      mosseDamageValue: existing?.mosseDamageValue || card.mosseDamageValue,
      mosseCanCounter: existing?.mosseCanCounter ?? card.mosseCanCounter ?? false,
      mosseCanBeCountered: existing?.mosseCanBeCountered ?? card.mosseCanBeCountered ?? false,
    });
  };

  const handleSaveModification = async () => {
    if (!editForm || !selectedCard) return;
    
    setSaving(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/card-modifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Modifica salvata con successo!' });
        await loadModifications();
        setSelectedCard(null);
        setEditForm(null);
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || 'Errore nel salvataggio' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handlePublishUpdate = async () => {
    if (!updateNote.trim()) {
      setMessage({ type: 'error', text: 'Inserisci una nota per l\'aggiornamento' });
      return;
    }

    setSaving(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/publish-card-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ note: updateNote })
      });

      if (res.ok) {
        const data = await res.json();
        setCardVersion(data.newVersion);
        setMessage({ type: 'success', text: `Aggiornamento v${data.newVersion} pubblicato! Notifica inviata a tutti gli utenti.` });
        setUpdateNote('');
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || 'Errore nella pubblicazione' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const filteredCards = cards.filter(card => 
    card.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Indietro</span>
          </button>
          
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Edit2 className="w-6 h-6 text-red-400" />
            Gestione Carte (Admin)
          </h1>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/50 rounded-lg">
            <span className="text-red-400">Versione Carte: v{cardVersion}</span>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca carte..."
                className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredCards.map(card => {
                const hasModification = modifications.some(m => m.cardId === card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => handleSelectCard(card)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      selectedCard?.id === card.id
                        ? 'bg-red-600'
                        : hasModification
                        ? 'bg-yellow-900/30 hover:bg-yellow-900/50'
                        : 'bg-slate-700/50 hover:bg-slate-700'
                    }`}
                  >
                    <img
                      src={card.frontImage}
                      alt={card.name}
                      className="w-12 h-16 object-cover rounded"
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white text-sm">
                        {card.name || 'Senza nome'}
                      </div>
                      <div className="text-xs text-slate-400 uppercase">
                        {card.type}
                      </div>
                      {hasModification && (
                        <div className="text-xs text-yellow-400">
                          Modificata
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedCard && editForm ? (
              <div className="bg-slate-800/50 rounded-xl p-6">
                <div className="flex items-start gap-6 mb-6">
                  <img
                    src={selectedCard.frontImage}
                    alt={selectedCard.name}
                    className="w-32 h-44 object-cover rounded-lg shadow-lg"
                  />
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white mb-2">
                      {selectedCard.name || 'Carta senza nome'}
                    </h2>
                    <div className="text-sm text-slate-400 mb-4">
                      ID: {selectedCard.id} | Tipo: {selectedCard.type.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Nome</label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {(selectedCard.type === 'personaggi' || selectedCard.type === 'personaggi_speciali') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">PTI</label>
                        <input
                          type="number"
                          value={editForm.pti || 0}
                          onChange={(e) => setEditForm({ ...editForm, pti: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Stelle</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={editForm.stars || 1}
                          onChange={(e) => setEditForm({ ...editForm, stars: parseInt(e.target.value) || 1 })}
                          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedCard.type === 'mosse' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Danno MOSSE</label>
                        <input
                          type="number"
                          value={editForm.mosseDamageValue || 0}
                          onChange={(e) => setEditForm({ ...editForm, mosseDamageValue: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.mosseCanCounter || false}
                            onChange={(e) => setEditForm({ ...editForm, mosseCanCounter: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-slate-300">Può contrattaccare</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.mosseCanBeCountered || false}
                            onChange={(e) => setEditForm({ ...editForm, mosseCanBeCountered: e.target.checked })}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-slate-300">Può essere contrattaccata</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-400 mb-1">Effetto</label>
                  <textarea
                    value={editForm.effect || ''}
                    onChange={(e) => setEditForm({ ...editForm, effect: e.target.value })}
                    rows={4}
                    className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handleSaveModification}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded-lg font-medium transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    Salva Modifica
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCard(null);
                      setEditForm(null);
                    }}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/50 rounded-xl p-6 text-center text-slate-400">
                <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Seleziona una carta dalla lista per modificarla</p>
              </div>
            )}

            <div className="bg-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-yellow-400" />
                Pubblica Aggiornamento Carte
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Quando pubblichi un aggiornamento, tutti gli utenti dell'app riceveranno una notifica
                e potranno scaricare le nuove modifiche alle carte.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Note dell'aggiornamento
                </label>
                <textarea
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                  placeholder="Es: Bilanciamento PTI personaggi, nuovi effetti bonus..."
                  rows={3}
                  className="w-full bg-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              
              <button
                onClick={handlePublishUpdate}
                disabled={saving || !updateNote.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                <Send className="w-5 h-5" />
                Pubblica Aggiornamento v{cardVersion + 1}
              </button>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Modifiche Pendenti ({modifications.length})
              </h3>
              {modifications.length === 0 ? (
                <p className="text-slate-400">Nessuna modifica in attesa</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {modifications.map(mod => (
                    <div key={mod.cardId} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                      <div>
                        <span className="text-white font-medium">{mod.name || mod.cardId}</span>
                        <div className="text-xs text-slate-400">
                          {mod.pti !== undefined && `PTI: ${mod.pti} | `}
                          {mod.stars !== undefined && `Stelle: ${mod.stars} | `}
                          {mod.mosseDamageValue !== undefined && `Danno: ${mod.mosseDamageValue}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
