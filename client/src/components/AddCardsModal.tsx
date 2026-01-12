import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Upload, Plus, Pencil, Trash2, Save, Shield, Sparkles, Search, RotateCcw, Volume2 } from "lucide-react";
import { socket } from "../lib/socket";
import { useGameState } from "../lib/stores/useGameState";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";

interface AddCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeckType = 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';

interface UploadedCardData {
  file: File;
  name: string;
  pti: number | null;
  stars: number | null;
  effect: string;
  audioUrl: string;
  isPermanent: boolean;
}

interface PermanentCard {
  id: number;
  name: string;
  deckType: string;
  imageData: string;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  audioUrl: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface ExistingCard {
  id: string;
  deckType: string;
  originalName: string;
  originalImageUrl: string;
  name: string | null;
  imageUrl: string | null;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  audioUrl: string | null;
  isDeleted: boolean;
  isModified: boolean;
}

export const AddCardsModal: React.FC<AddCardsModalProps> = ({ isOpen, onClose }) => {
  const [selectedDeck, setSelectedDeck] = useState<DeckType>('personaggi');
  const [uploadedCards, setUploadedCards] = useState<UploadedCardData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [permanentCards, setPermanentCards] = useState<PermanentCard[]>([]);
  const [loadingPermanent, setLoadingPermanent] = useState(false);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', pti: '', stars: '', effect: '', audioUrl: '' });
  const [activeTab, setActiveTab] = useState<'add' | 'manage' | 'existing'>('add');
  const { gameId, playerName } = useGameState();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [existingCards, setExistingCards] = useState<ExistingCard[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [editingExistingCard, setEditingExistingCard] = useState<string | null>(null);
  const [existingEditForm, setExistingEditForm] = useState({ name: '', imageUrl: '', pti: '', stars: '', effect: '', audioUrl: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const isCharacterDeck = selectedDeck === 'personaggi' || selectedDeck === 'personaggi_speciali';
  const authToken = localStorage.getItem('authToken') || '';

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!authToken) {
        setIsAdmin(false);
        return;
      }
      try {
        const res = await fetch('/api/admin/check', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    
    if (isOpen) {
      checkAdmin();
    }
  }, [isOpen, authToken]);

  const fetchPermanentCards = async () => {
    setLoadingPermanent(true);
    try {
      const response = await fetch('/api/custom-cards');
      const data = await response.json();
      if (data.success) {
        setPermanentCards(data.cards);
      }
    } catch (error) {
      console.error('Error fetching permanent cards:', error);
    } finally {
      setLoadingPermanent(false);
    }
  };

  const fetchExistingCards = async () => {
    if (!isAdmin || !authToken) return;
    setLoadingExisting(true);
    try {
      const response = await fetch(`/api/admin/existing-cards?deckType=${selectedDeck}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setExistingCards(data.cards);
      }
    } catch (error) {
      console.error('Error fetching existing cards:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPermanentCards();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isAdmin && activeTab === 'existing') {
      fetchExistingCards();
    }
  }, [isOpen, isAdmin, activeTab, selectedDeck]);

  useEffect(() => {
    const handleCardsAdded = () => {
      setUploadedCards([]);
      setIsUploading(false);
      fetchPermanentCards();
      onClose();
    };

    socket.on('cards-added', handleCardsAdded);
    return () => { socket.off('cards-added', handleCardsAdded); };
  }, [onClose]);

  if (!isOpen) return null;

  const deckOptions = [
    { value: 'personaggi', label: 'PERSONAGGI', color: 'bg-blue-600' },
    { value: 'mosse', label: 'MOSSE', color: 'bg-red-600' },
    { value: 'bonus', label: 'BONUS', color: 'bg-black' },
    { value: 'personaggi_speciali', label: 'PERSONAGGI SPECIALI', color: 'bg-yellow-500' }
  ];

  const getDeckLabel = (deckType: string) => {
    const option = deckOptions.find(d => d.value === deckType);
    return option?.label || deckType.toUpperCase();
  };

  const getDeckColor = (deckType: string) => {
    const option = deckOptions.find(d => d.value === deckType);
    return option?.color || 'bg-gray-600';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    const newCards: UploadedCardData[] = imageFiles.map(file => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      pti: null,
      stars: null,
      effect: '',
      audioUrl: '',
      isPermanent: false
    }));
    
    setUploadedCards(prev => [...prev, ...newCards]);
  };

  const removeCard = (index: number) => {
    setUploadedCards(prev => prev.filter((_, i) => i !== index));
  };

  const updateCardData = (index: number, field: keyof UploadedCardData, value: any) => {
    setUploadedCards(prev => prev.map((card, i) => 
      i === index ? { ...card, [field]: value } : card
    ));
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error(`Immagine troppo grande: ${file.name}. Limite 5MB.`));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAddCards = async () => {
    if (uploadedCards.length === 0) {
      alert('Seleziona almeno un\'immagine!');
      return;
    }

    const missingNames = uploadedCards.some(card => !card.name.trim());
    if (missingNames) {
      alert('Inserisci il nome per tutte le carte!');
      return;
    }

    setIsUploading(true);
    
    try {
      const cardsData = await Promise.all(
        uploadedCards.map(async (card) => {
          const base64 = await convertToBase64(card.file);
          return {
            name: card.name.trim(),
            data: base64,
            pti: isCharacterDeck ? card.pti : null,
            stars: isCharacterDeck ? card.stars : null,
            effect: card.effect.trim() || null,
            audioUrl: card.audioUrl.trim() || null,
            isPermanent: card.isPermanent
          };
        })
      );

      socket.emit('add-custom-cards', {
        gameId,
        playerName,
        deckType: selectedDeck,
        cards: cardsData
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Errore durante il caricamento delle immagini');
      setIsUploading(false);
    }
  };

  const setAllPermanent = (permanent: boolean) => {
    setUploadedCards(prev => prev.map(card => ({ ...card, isPermanent: permanent })));
  };

  const handleEditCard = (card: PermanentCard) => {
    setEditingCard(card.id);
    setEditForm({
      name: card.name,
      pti: card.pti?.toString() || '',
      stars: card.stars?.toString() || '',
      effect: card.effect || '',
      audioUrl: card.audioUrl || ''
    });
  };

  const handleSaveEdit = async (cardId: number) => {
    try {
      const response = await fetch(`/api/custom-cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          pti: editForm.pti ? parseInt(editForm.pti) : null,
          stars: editForm.stars ? parseInt(editForm.stars) : null,
          effect: editForm.effect || null,
          audioUrl: editForm.audioUrl || null
        })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchPermanentCards();
        setEditingCard(null);
      } else {
        alert('Errore durante il salvataggio');
      }
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa carta permanente?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/custom-cards/${cardId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchPermanentCards();
      } else {
        alert('Errore durante l\'eliminazione');
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleEditExistingCard = (card: ExistingCard) => {
    setEditingExistingCard(card.id);
    setExistingEditForm({
      name: card.name || '',
      imageUrl: card.imageUrl || '',
      pti: card.pti?.toString() || '',
      stars: card.stars?.toString() || '',
      effect: card.effect || '',
      audioUrl: card.audioUrl || ''
    });
  };

  const handleSaveExistingEdit = async (card: ExistingCard) => {
    try {
      const response = await fetch('/api/admin/card-modification', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          originalCardId: card.id,
          deckType: card.deckType,
          name: existingEditForm.name || null,
          imageUrl: existingEditForm.imageUrl || null,
          pti: existingEditForm.pti || null,
          stars: existingEditForm.stars || null,
          effect: existingEditForm.effect || null,
          audioUrl: existingEditForm.audioUrl || null
        })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchExistingCards();
        setEditingExistingCard(null);
        alert('Modifiche salvate!');
      } else {
        alert('Errore durante il salvataggio');
      }
    } catch (error) {
      console.error('Error saving existing card modification:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleToggleDeleteExisting = async (card: ExistingCard) => {
    const newDeletedState = !card.isDeleted;
    const confirmMsg = newDeletedState 
      ? `Vuoi eliminare "${card.name || card.originalName}" dal gioco? La carta non apparira piu nelle partite.`
      : `Vuoi ripristinare "${card.name || card.originalName}"? La carta tornera disponibile nelle partite.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const response = await fetch('/api/admin/card-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          originalCardId: card.id,
          deckType: card.deckType,
          isDeleted: newDeletedState
        })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchExistingCards();
        alert(newDeletedState ? 'Carta eliminata!' : 'Carta ripristinata!');
      } else {
        alert('Errore durante l\'operazione');
      }
    } catch (error) {
      console.error('Error toggling card deletion:', error);
      alert('Errore durante l\'operazione');
    }
  };

  const filteredPermanentCards = permanentCards.filter(card => card.deckType === selectedDeck);
  
  const filteredExistingCards = existingCards.filter(card => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.originalName.toLowerCase().includes(query) ||
      (card.name && card.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-xl">GESTIONE CARTE</h3>
            {isAdmin && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                <Shield size={12} />
                ADMIN
              </span>
            )}
          </div>
          <Button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
            size="sm"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-3 font-bold ${activeTab === 'add' ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'}`}
          >
            <Plus size={18} className="mr-2" />
            AGGIUNGI CARTE
          </Button>
          <Button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-3 font-bold ${activeTab === 'manage' ? 'bg-purple-600' : 'bg-gray-600 hover:bg-gray-500'}`}
          >
            <Pencil size={18} className="mr-2" />
            CARTE PERMANENTI ({permanentCards.length})
          </Button>
          {isAdmin && (
            <Button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 py-3 font-bold ${activeTab === 'existing' ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'}`}
            >
              <Shield size={18} className="mr-2" />
              MODIFICA CARTE GIOCO
            </Button>
          )}
        </div>

        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">Scegli il mazzo:</h4>
          <div className="grid grid-cols-2 gap-3">
            {deckOptions.map((deck) => (
              <Button
                key={deck.value}
                onClick={() => {
                  setSelectedDeck(deck.value as DeckType);
                  setUploadedCards([]);
                }}
                className={`${deck.color} hover:opacity-80 text-white font-bold py-3 border-2 ${
                  selectedDeck === deck.value ? 'border-yellow-400' : 'border-transparent'
                }`}
              >
                {deck.label}
              </Button>
            ))}
          </div>
        </div>

        {activeTab === 'add' && (
          <>
            <div className="mb-6">
              <h4 className="text-white font-semibold mb-3">Carica immagini:</h4>
              <div className="border-2 border-dashed border-gray-400 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <Upload size={40} className="text-gray-400" />
                  <span className="text-white">
                    Clicca per selezionare immagini
                  </span>
                  <span className="text-gray-400 text-sm">
                    Formati supportati: JPG, PNG, GIF, WEBP
                  </span>
                </label>
              </div>
            </div>

            {uploadedCards.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">
                    Carte da aggiungere ({uploadedCards.length}):
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setAllPermanent(true)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                      size="sm"
                    >
                      Tutte permanenti
                    </Button>
                    <Button
                      onClick={() => setAllPermanent(false)}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1"
                      size="sm"
                    >
                      Tutte temporanee
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                  {uploadedCards.map((card, index) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4 relative">
                      <Button
                        onClick={() => removeCard(index)}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 h-6 w-6"
                        size="sm"
                      >
                        <X size={12} />
                      </Button>
                      
                      <div className="flex gap-4">
                        <img
                          src={URL.createObjectURL(card.file)}
                          alt={card.name}
                          className="w-20 h-28 object-cover rounded border-2 border-orange-500 flex-shrink-0"
                        />
                        
                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="text-white text-sm mb-1 block">Nome carta *</label>
                            <Input
                              type="text"
                              value={card.name}
                              onChange={(e) => updateCardData(index, 'name', e.target.value)}
                              placeholder="Inserisci nome carta"
                              className="bg-gray-600 text-white border-gray-500"
                            />
                          </div>
                          
                          {isCharacterDeck && (
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="text-white text-sm mb-1 block">PTI</label>
                                <Input
                                  type="number"
                                  value={card.pti ?? ''}
                                  onChange={(e) => updateCardData(index, 'pti', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="PTI"
                                  className="bg-gray-600 text-white border-gray-500"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-white text-sm mb-1 block">Stelle</label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={card.stars ?? ''}
                                  onChange={(e) => updateCardData(index, 'stars', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="Stelle"
                                  className="bg-gray-600 text-white border-gray-500"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="text-white text-sm mb-1 flex items-center gap-1">
                              <Sparkles size={14} className="text-purple-400" />
                              Effetto (elaborato da AI)
                            </label>
                            <textarea
                              value={card.effect}
                              onChange={(e) => updateCardData(index, 'effect', e.target.value)}
                              placeholder="Descrivi l'effetto della carta... (non visibile sulla carta, gestito dal sistema)"
                              className="w-full bg-gray-600 text-white border border-gray-500 rounded-md p-2 text-sm resize-none"
                              rows={2}
                            />
                          </div>
                          
                          <div>
                            <label className="text-white text-sm mb-1 flex items-center gap-1">
                              <Volume2 size={14} className="text-cyan-400" />
                              Audio (URL o link)
                            </label>
                            <Input
                              type="text"
                              value={card.audioUrl}
                              onChange={(e) => updateCardData(index, 'audioUrl', e.target.value)}
                              placeholder="https://... o link audio da riprodurre quando la carta viene giocata"
                              className="bg-gray-600 text-white border-gray-500"
                            />
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div 
                              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                                card.isPermanent 
                                  ? 'bg-green-600/30 border border-green-500' 
                                  : 'bg-orange-600/30 border border-orange-500'
                              }`}
                              onClick={() => updateCardData(index, 'isPermanent', !card.isPermanent)}
                            >
                              <Checkbox 
                                checked={card.isPermanent}
                                onCheckedChange={(checked) => updateCardData(index, 'isPermanent', checked)}
                                className="border-white"
                              />
                              <span className="text-white text-sm">
                                {card.isPermanent ? 'Carta permanente' : 'Solo questa partita'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleAddCards}
                disabled={uploadedCards.length === 0 || isUploading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                {isUploading ? 'CARICAMENTO...' : `AGGIUNGI ${uploadedCards.length} CARTE`}
              </Button>
              
              <Button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6"
              >
                ANNULLA
              </Button>
            </div>

            <div className="mt-4 text-gray-400 text-xs text-center space-y-1">
              <p><strong>Temporanea:</strong> La carta sara disponibile solo per questa partita</p>
              <p><strong>Permanente:</strong> La carta sara salvata e disponibile in tutte le partite future</p>
              <p><strong>Effetto:</strong> Descrivi come funziona la carta - il sistema lo elaborera automaticamente</p>
            </div>
          </>
        )}

        {activeTab === 'manage' && (
          <div>
            <h4 className="text-white font-semibold mb-3">
              Carte permanenti in {getDeckLabel(selectedDeck)} ({filteredPermanentCards.length}):
            </h4>
            
            {loadingPermanent ? (
              <div className="text-center text-gray-400 py-8">Caricamento...</div>
            ) : filteredPermanentCards.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                Nessuna carta permanente in questo mazzo
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {filteredPermanentCards.map((card) => (
                  <div key={card.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex gap-4">
                      <img
                        src={card.imageData}
                        alt={card.name}
                        className={`w-20 h-28 object-cover rounded border-2 flex-shrink-0 ${getDeckColor(card.deckType).replace('bg-', 'border-')}`}
                      />
                      
                      <div className="flex-1">
                        {editingCard === card.id ? (
                          <div className="space-y-3">
                            <Input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Nome carta"
                              className="bg-gray-600 text-white border-gray-500"
                            />
                            
                            {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && (
                              <div className="flex gap-3">
                                <Input
                                  type="number"
                                  value={editForm.pti}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, pti: e.target.value }))}
                                  placeholder="PTI"
                                  className="bg-gray-600 text-white border-gray-500 flex-1"
                                />
                                <Input
                                  type="number"
                                  value={editForm.stars}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, stars: e.target.value }))}
                                  placeholder="Stelle"
                                  className="bg-gray-600 text-white border-gray-500 flex-1"
                                />
                              </div>
                            )}
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Sparkles size={14} className="text-purple-400" />
                                Effetto (AI)
                              </label>
                              <textarea
                                value={editForm.effect}
                                onChange={(e) => setEditForm(prev => ({ ...prev, effect: e.target.value }))}
                                placeholder="Descrivi l'effetto..."
                                className="w-full bg-gray-600 text-white border border-gray-500 rounded-md p-2 text-sm resize-none"
                                rows={2}
                              />
                            </div>
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Volume2 size={14} className="text-cyan-400" />
                                Audio URL
                              </label>
                              <Input
                                type="text"
                                value={editForm.audioUrl}
                                onChange={(e) => setEditForm(prev => ({ ...prev, audioUrl: e.target.value }))}
                                placeholder="https://... link audio"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSaveEdit(card.id)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                                size="sm"
                              >
                                <Save size={14} className="mr-1" />
                                Salva
                              </Button>
                              <Button
                                onClick={() => setEditingCard(null)}
                                className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1"
                                size="sm"
                              >
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h5 className="text-white font-bold text-lg">{card.name}</h5>
                            <div className={`inline-block px-2 py-1 rounded text-xs text-white mb-2 ${getDeckColor(card.deckType)}`}>
                              {getDeckLabel(card.deckType)}
                            </div>
                            
                            {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && (
                              <div className="text-gray-300 text-sm">
                                {card.pti !== null && <span className="mr-3">PTI: {card.pti}</span>}
                                {card.stars !== null && <span>Stelle: {card.stars}</span>}
                              </div>
                            )}
                            
                            {card.effect && (
                              <div className="text-purple-300 text-xs mt-1 flex items-center gap-1">
                                <Sparkles size={12} />
                                Effetto: {card.effect.substring(0, 50)}...
                              </div>
                            )}
                            
                            {card.createdBy && (
                              <div className="text-gray-400 text-xs mt-1">
                                Creata da: {card.createdBy}
                              </div>
                            )}
                            
                            <div className="flex gap-2 mt-3">
                              <Button
                                onClick={() => handleEditCard(card)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1"
                                size="sm"
                              >
                                <Pencil size={14} className="mr-1" />
                                Modifica
                              </Button>
                              <Button
                                onClick={() => handleDeleteCard(card.id)}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1"
                                size="sm"
                              >
                                <Trash2 size={14} className="mr-1" />
                                Elimina
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 text-gray-400 text-xs text-center">
              <p>Le carte permanenti vengono caricate automaticamente all'inizio di ogni nuova partita</p>
            </div>
          </div>
        )}

        {activeTab === 'existing' && isAdmin && (
          <div>
            <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3 mb-4">
              <p className="text-yellow-300 text-sm flex items-center gap-2">
                <Shield size={16} />
                <strong>Modalita Admin:</strong> Modifica le carte esistenti del gioco. Le modifiche sono permanenti.
              </p>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca carta per nome..."
                  className="bg-gray-700 text-white border-gray-500 pl-10"
                />
              </div>
            </div>

            <h4 className="text-white font-semibold mb-3">
              Carte in {getDeckLabel(selectedDeck)} ({filteredExistingCards.length}):
            </h4>
            
            {loadingExisting ? (
              <div className="text-center text-gray-400 py-8">Caricamento...</div>
            ) : filteredExistingCards.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                Nessuna carta trovata
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                {filteredExistingCards.map((card) => (
                  <div key={card.id} className={`bg-gray-700 rounded-lg p-4 ${card.isDeleted ? 'opacity-50 border-2 border-red-500' : card.isModified ? 'border-2 border-yellow-500' : ''}`}>
                    <div className="flex gap-4">
                      <div className="relative">
                        <img
                          src={card.imageUrl || card.originalImageUrl}
                          alt={card.name || card.originalName}
                          className={`w-20 h-28 object-cover rounded border-2 flex-shrink-0 ${card.isDeleted ? 'grayscale' : ''} ${getDeckColor(card.deckType).replace('bg-', 'border-')}`}
                        />
                        {card.isDeleted && (
                          <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 rounded">
                            <Trash2 size={24} className="text-red-300" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        {editingExistingCard === card.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-gray-400 text-xs">Nome originale: {card.originalName}</label>
                              <Input
                                type="text"
                                value={existingEditForm.name}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Nuovo nome (lascia vuoto per originale)"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            <div>
                              <label className="text-gray-400 text-xs">URL Immagine personalizzata</label>
                              <Input
                                type="text"
                                value={existingEditForm.imageUrl}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                placeholder="URL nuova immagine (lascia vuoto per originale)"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            {isCharacterDeck && (
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="text-gray-400 text-xs">PTI</label>
                                  <Input
                                    type="number"
                                    value={existingEditForm.pti}
                                    onChange={(e) => setExistingEditForm(prev => ({ ...prev, pti: e.target.value }))}
                                    placeholder="PTI"
                                    className="bg-gray-600 text-white border-gray-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-gray-400 text-xs">Stelle</label>
                                  <Input
                                    type="number"
                                    value={existingEditForm.stars}
                                    onChange={(e) => setExistingEditForm(prev => ({ ...prev, stars: e.target.value }))}
                                    placeholder="Stelle"
                                    className="bg-gray-600 text-white border-gray-500"
                                  />
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Sparkles size={14} className="text-purple-400" />
                                Effetto (elaborato da AI)
                              </label>
                              <textarea
                                value={existingEditForm.effect}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, effect: e.target.value }))}
                                placeholder="Descrivi l'effetto della carta... Il sistema lo elaborera automaticamente durante il gioco."
                                className="w-full bg-gray-600 text-white border border-gray-500 rounded-md p-2 text-sm resize-none"
                                rows={3}
                              />
                            </div>
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Volume2 size={14} className="text-cyan-400" />
                                Audio URL
                              </label>
                              <Input
                                type="text"
                                value={existingEditForm.audioUrl}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, audioUrl: e.target.value }))}
                                placeholder="https://... link audio da riprodurre quando la carta viene giocata"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSaveExistingEdit(card)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1"
                                size="sm"
                              >
                                <Save size={14} className="mr-1" />
                                Salva Modifiche
                              </Button>
                              <Button
                                onClick={() => setEditingExistingCard(null)}
                                className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1"
                                size="sm"
                              >
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className={`font-bold text-lg ${card.isDeleted ? 'text-red-400 line-through' : 'text-white'}`}>
                                {card.name || card.originalName}
                              </h5>
                              {card.isDeleted && (
                                <span className="bg-red-500 text-white text-xs px-1 rounded">Eliminata</span>
                              )}
                              {card.isModified && !card.isDeleted && (
                                <span className="bg-yellow-500 text-black text-xs px-1 rounded">Modificata</span>
                              )}
                            </div>
                            
                            {card.name && card.name !== card.originalName && (
                              <div className="text-gray-400 text-xs">
                                Originale: {card.originalName}
                              </div>
                            )}
                            
                            <div className={`inline-block px-2 py-1 rounded text-xs text-white mb-2 ${getDeckColor(card.deckType)}`}>
                              {getDeckLabel(card.deckType)}
                            </div>
                            
                            {isCharacterDeck && (card.pti || card.stars) && (
                              <div className="text-gray-300 text-sm">
                                {card.pti !== null && <span className="mr-3">PTI: {card.pti}</span>}
                                {card.stars !== null && <span>Stelle: {card.stars}</span>}
                              </div>
                            )}
                            
                            {card.effect && (
                              <div className="text-purple-300 text-xs mt-1 flex items-start gap-1">
                                <Sparkles size={12} className="mt-0.5 flex-shrink-0" />
                                <span>Effetto: {card.effect.substring(0, 80)}{card.effect.length > 80 ? '...' : ''}</span>
                              </div>
                            )}
                            
                            <div className="flex gap-2 mt-3">
                              {!card.isDeleted && (
                                <Button
                                  onClick={() => handleEditExistingCard(card)}
                                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-xs px-3 py-1"
                                  size="sm"
                                >
                                  <Pencil size={14} className="mr-1" />
                                  Modifica
                                </Button>
                              )}
                              <Button
                                onClick={() => handleToggleDeleteExisting(card)}
                                className={`${card.isDeleted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white text-xs px-3 py-1`}
                                size="sm"
                              >
                                {card.isDeleted ? (
                                  <>
                                    <RotateCcw size={14} className="mr-1" />
                                    Ripristina
                                  </>
                                ) : (
                                  <>
                                    <Trash2 size={14} className="mr-1" />
                                    Elimina
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 text-gray-400 text-xs text-center">
              <p>Le modifiche vengono applicate a tutte le partite future</p>
              <p className="text-purple-300 mt-1">L'effetto descritto verra elaborato dall'AI durante il gioco</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
