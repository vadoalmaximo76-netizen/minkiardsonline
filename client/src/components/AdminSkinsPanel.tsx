import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, Image, Crown, Sparkles, Star, Palette, ChevronDown } from 'lucide-react';

interface CardSkin {
  id: number;
  name: string;
  cardName: string | null;
  description: string | null;
  borderStyle: string | null;
  backgroundGradient: string | null;
  glowColor: string | null;
  skinImageUrl: string | null;
  rarity: string;
  price: number;
  isAvailable: boolean;
}

interface AdminSkinsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

interface CardNamesByDeck {
  personaggi: string[];
  mosse: string[];
  bonus: string[];
  personaggi_speciali: string[];
  carte_personalizzate: string[];
}

const DECK_LABELS: { [key: string]: string } = {
  personaggi: 'PERSONAGGI',
  mosse: 'MOSSE',
  bonus: 'BONUS',
  personaggi_speciali: 'PERSONAGGI SPECIALI',
  carte_personalizzate: 'CARTE PERSONALIZZATE'
};

const RARITY_OPTIONS = [
  { value: 'common', label: 'Comune', color: 'gray' },
  { value: 'rare', label: 'Rara', color: 'blue' },
  { value: 'epic', label: 'Epica', color: 'purple' },
  { value: 'legendary', label: 'Leggendaria', color: 'amber' }
];

export function AdminSkinsPanel({ isOpen, onClose, authToken }: AdminSkinsPanelProps) {
  const [skins, setSkins] = useState<CardSkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSkin, setEditingSkin] = useState<CardSkin | null>(null);
  const [cardNamesByDeck, setCardNamesByDeck] = useState<CardNamesByDeck | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    cardName: '',
    description: '',
    skinImageUrl: '',
    rarity: 'common',
    price: 100,
    borderStyle: '',
    glowColor: '',
    isAvailable: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && authToken) {
      fetchSkins();
      fetchCardNames();
    }
  }, [isOpen, authToken]);

  const fetchCardNames = async () => {
    try {
      const res = await fetch('/api/all-card-names');
      const data = await res.json();
      if (data.success) {
        setCardNamesByDeck(data.cardNames);
      }
    } catch (error) {
      console.error('Failed to fetch card names:', error);
    }
  };

  const fetchSkins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/card-skins');
      const data = await res.json();
      if (data.success) {
        setSkins(data.skins);
      }
    } catch (error) {
      console.error('Failed to fetch skins:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cardName: '',
      description: '',
      skinImageUrl: '',
      rarity: 'common',
      price: 100,
      borderStyle: '',
      glowColor: '',
      isAvailable: true
    });
    setEditingSkin(null);
    setError('');
  };

  const handleEdit = (skin: CardSkin) => {
    setEditingSkin(skin);
    setFormData({
      name: skin.name,
      cardName: skin.cardName || '',
      description: skin.description || '',
      skinImageUrl: skin.skinImageUrl || '',
      rarity: skin.rarity || 'common',
      price: skin.price || 100,
      borderStyle: skin.borderStyle || '',
      glowColor: skin.glowColor || '',
      isAvailable: skin.isAvailable
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    setError('');
    setSuccess('');

    try {
      const url = editingSkin 
        ? `/api/admin/card-skins/${editingSkin.id}`
        : '/api/admin/card-skins';
      
      const method = editingSkin ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(editingSkin ? 'Skin aggiornata!' : 'Skin creata!');
        resetForm();
        setShowForm(false);
        fetchSkins();
      } else {
        setError(data.error || 'Operazione fallita');
      }
    } catch (error) {
      setError('Errore di connessione');
    }
  };

  const handleDelete = async (skinId: number) => {
    if (!authToken) return;
    if (!confirm('Sei sicuro di voler eliminare questa skin?')) return;

    try {
      const res = await fetch(`/api/admin/card-skins/${skinId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Skin eliminata');
        fetchSkins();
      } else {
        setError(data.error || 'Eliminazione fallita');
      }
    } catch (error) {
      setError('Errore di connessione');
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return <Crown className="w-4 h-4 text-amber-400" />;
      case 'epic': return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'rare': return <Star className="w-4 h-4 text-blue-400" />;
      default: return <Palette className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'border-amber-400 shadow-amber-400/30';
      case 'epic': return 'border-purple-400 shadow-purple-400/30';
      case 'rare': return 'border-blue-400 shadow-blue-400/30';
      default: return 'border-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-amber-600/50">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Gestione Skin (Admin)
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded-lg mb-4">
              {success}
            </div>
          )}

          {!showForm ? (
            <>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 mb-4"
              >
                <Plus className="w-5 h-5" />
                Nuova Skin
              </button>

              {loading ? (
                <div className="text-center text-gray-400 py-8">Caricamento...</div>
              ) : skins.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  Nessuna skin creata. Clicca "Nuova Skin" per iniziare.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {skins.map(skin => (
                    <div
                      key={skin.id}
                      className={`bg-gray-800 rounded-lg border-2 shadow-lg p-4 ${getRarityBorder(skin.rarity)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getRarityIcon(skin.rarity)}
                          <span className="font-bold text-white">{skin.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(skin)}
                            className="p-1 hover:bg-gray-700 rounded"
                          >
                            <Edit2 className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(skin.id)}
                            className="p-1 hover:bg-gray-700 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {skin.skinImageUrl && (
                        <div className="mb-2 rounded overflow-hidden">
                          <img
                            src={skin.skinImageUrl}
                            alt={skin.name}
                            className="w-full h-24 object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}

                      <div className="text-sm text-gray-400 space-y-1">
                        {skin.cardName && <div>Carta: <span className="text-white">{skin.cardName}</span></div>}
                        <div>Prezzo: <span className="text-amber-400">{skin.price} R</span></div>
                        <div>Disponibile: <span className={skin.isAvailable ? 'text-green-400' : 'text-red-400'}>
                          {skin.isAvailable ? 'Sì' : 'No'}
                        </span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  {editingSkin ? 'Modifica Skin' : 'Nuova Skin'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nome Skin *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    placeholder="es. Aura Dorata"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Mazzo</label>
                  <select
                    value={selectedDeck}
                    onChange={e => {
                      setSelectedDeck(e.target.value);
                      setFormData({ ...formData, cardName: '' });
                    }}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">-- Seleziona mazzo --</option>
                    {cardNamesByDeck && Object.keys(cardNamesByDeck).map(deck => (
                      <option key={deck} value={deck}>{DECK_LABELS[deck] || deck.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Carta Associata</label>
                  <select
                    value={formData.cardName}
                    onChange={e => setFormData({ ...formData, cardName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    disabled={!selectedDeck}
                  >
                    <option value="">-- Seleziona carta --</option>
                    {selectedDeck && cardNamesByDeck && cardNamesByDeck[selectedDeck as keyof CardNamesByDeck]?.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {!selectedDeck && (
                    <p className="text-xs text-gray-500 mt-1">Seleziona prima un mazzo</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rarità</label>
                  <select
                    value={formData.rarity}
                    onChange={e => setFormData({ ...formData, rarity: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    {RARITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Prezzo (Rankiard)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    <Image className="w-4 h-4 inline mr-1" />
                    URL Immagine Skin
                  </label>
                  <input
                    type="url"
                    value={formData.skinImageUrl}
                    onChange={e => setFormData({ ...formData, skinImageUrl: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    placeholder="https://esempio.com/immagine.png"
                  />
                  {formData.skinImageUrl && (
                    <div className="mt-2 p-2 bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Anteprima:</p>
                      <img
                        src={formData.skinImageUrl}
                        alt="Anteprima"
                        className="max-h-32 rounded"
                        onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                      />
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Descrizione</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    rows={2}
                    placeholder="Descrizione opzionale della skin..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Stile Bordo (CSS)</label>
                  <input
                    type="text"
                    value={formData.borderStyle}
                    onChange={e => setFormData({ ...formData, borderStyle: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    placeholder="es. 3px solid gold"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Colore Glow</label>
                  <input
                    type="text"
                    value={formData.glowColor}
                    onChange={e => setFormData({ ...formData, glowColor: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    placeholder="es. rgba(255, 215, 0, 0.5)"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isAvailable"
                    checked={formData.isAvailable}
                    onChange={e => setFormData({ ...formData, isAvailable: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isAvailable" className="text-sm text-gray-300">
                    Disponibile per l'acquisto
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {editingSkin ? 'Aggiorna' : 'Crea Skin'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
                >
                  Annulla
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
