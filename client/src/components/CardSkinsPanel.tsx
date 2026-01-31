import React, { useState, useEffect } from 'react';
import { X, Palette, Check, ShoppingCart, Star, Sparkles, Crown, Eye } from 'lucide-react';

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

interface PlayerSkin {
  id: number;
  skinId: number;
  isEquipped: boolean;
}

interface CardSkinsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
  userRankiards: number;
}

export function CardSkinsPanel({ isOpen, onClose, authToken, userRankiards }: CardSkinsPanelProps) {
  const [skins, setSkins] = useState<CardSkin[]>([]);
  const [ownedSkins, setOwnedSkins] = useState<PlayerSkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<CardSkin | null>(null);
  const [previewSkin, setPreviewSkin] = useState<CardSkin | null>(null);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchSkins();
      fetchOwnedSkins();
    }
  }, [isOpen, authToken]);

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

  const fetchOwnedSkins = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/card-skins/owned', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setOwnedSkins(data.skins);
      }
    } catch (error) {
      console.error('Failed to fetch owned skins:', error);
    }
  };

  const handlePurchase = async (skinId: number) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/card-skins/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ skinId })
      });
      const data = await res.json();
      if (data.success) {
        fetchOwnedSkins();
      }
    } catch (error) {
      console.error('Failed to purchase skin:', error);
    }
  };

  const handleEquip = async (skinId: number) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/card-skins/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ skinId })
      });
      const data = await res.json();
      if (data.success) {
        fetchOwnedSkins();
      }
    } catch (error) {
      console.error('Failed to equip skin:', error);
    }
  };

  const isOwned = (skinId: number) => ownedSkins.some(s => s.skinId === skinId);
  const isEquipped = (skinId: number) => ownedSkins.some(s => s.skinId === skinId && s.isEquipped);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 to-orange-600';
      case 'epic': return 'from-purple-500 to-pink-600';
      case 'rare': return 'from-blue-500 to-cyan-600';
      default: return 'from-gray-500 to-slate-600';
    }
  };

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'epic': return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'rare': return <Star className="w-4 h-4 text-blue-400" />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-600">
        <div className="flex items-center justify-between p-4 border-b border-slate-600 bg-gradient-to-r from-violet-600 to-purple-600">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Skin Carte
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-bold">{userRankiards}</span>
              <span className="text-white/70 text-sm">Rankiard</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading && (
            <div className="text-center py-12 text-slate-400">
              Caricamento skin...
            </div>
          )}

          {!loading && skins.length === 0 && (
            <div className="text-center py-12">
              <Palette className="w-16 h-16 mx-auto mb-4 text-violet-400 opacity-50" />
              <p className="text-slate-400">Nessuna skin disponibile</p>
              <p className="text-slate-500 text-sm mt-2">Le skin saranno disponibili presto!</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {skins.map(skin => (
              <div
                key={skin.id}
                onClick={() => setSelectedSkin(skin)}
                className={`relative bg-slate-800 rounded-xl p-4 cursor-pointer transition-all hover:scale-105 border-2 ${
                  selectedSkin?.id === skin.id ? 'border-violet-500' : 'border-slate-700'
                } ${isEquipped(skin.id) ? 'ring-2 ring-green-500' : ''}`}
              >
                {isEquipped(skin.id) && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <div className={`relative w-full h-24 rounded-lg bg-gradient-to-br ${skin.backgroundGradient || getRarityColor(skin.rarity)} mb-3 flex items-center justify-center overflow-hidden`}
                     style={{ 
                       boxShadow: skin.glowColor ? `0 0 20px ${skin.glowColor}` : undefined,
                       border: skin.borderStyle || undefined
                     }}>
                  {skin.skinImageUrl ? (
                    <img src={skin.skinImageUrl} alt={skin.name} className="w-full h-full object-cover opacity-70" />
                  ) : (
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <span className="text-3xl">🃏</span>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewSkin(skin);
                    }}
                    className="absolute top-1 left-1 p-1.5 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    title="Anteprima"
                  >
                    <Eye className="w-3 h-3 text-white" />
                  </button>
                </div>

                <div className="flex items-center gap-1 mb-1">
                  {getRarityIcon(skin.rarity)}
                  <h3 className="text-white font-bold text-sm truncate">{skin.name}</h3>
                </div>

                {skin.description && (
                  <p className="text-slate-400 text-xs mb-3 line-clamp-2">{skin.description}</p>
                )}

                <div className="flex items-center justify-between">
                  {isOwned(skin.id) ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEquip(skin.id);
                      }}
                      disabled={isEquipped(skin.id)}
                      className={`w-full py-2 rounded-lg text-sm font-bold transition-colors ${
                        isEquipped(skin.id)
                          ? 'bg-green-600 text-white cursor-default'
                          : 'bg-violet-600 hover:bg-violet-500 text-white'
                      }`}
                    >
                      {isEquipped(skin.id) ? 'Equipaggiata' : 'Equipaggia'}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePurchase(skin.id);
                      }}
                      disabled={userRankiards < skin.price}
                      className={`w-full py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1 ${
                        userRankiards >= skin.price
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {skin.price}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {previewSkin && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewSkin(null)}
        >
          <div 
            className="relative max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewSkin(null)}
              className="absolute -top-12 right-0 p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              {previewSkin.skinImageUrl ? (
                <div className="relative">
                  <img 
                    src={previewSkin.skinImageUrl} 
                    alt={previewSkin.name} 
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-4">
                    <div className="text-center">
                      <span className="text-white/60 text-lg font-light tracking-widest uppercase">
                        ANTEPRIMA SKIN
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {getRarityIcon(previewSkin.rarity)}
                        <h3 className="text-2xl font-bold text-white">{previewSkin.name}</h3>
                      </div>
                      {previewSkin.cardName && (
                        <p className="text-amber-400 font-medium">
                          Carta: {previewSkin.cardName}
                        </p>
                      )}
                      {previewSkin.description && (
                        <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto">
                          {previewSkin.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`w-full h-80 bg-gradient-to-br ${previewSkin.backgroundGradient || getRarityColor(previewSkin.rarity)} flex flex-col items-center justify-center`}
                     style={{ 
                       boxShadow: previewSkin.glowColor ? `0 0 40px ${previewSkin.glowColor}` : undefined,
                       border: previewSkin.borderStyle || undefined
                     }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-4">
                    <div className="text-center">
                      <span className="text-white/60 text-lg font-light tracking-widest uppercase">
                        ANTEPRIMA SKIN
                      </span>
                    </div>
                    <div></div>
                  </div>
                  <div className="bg-slate-900/50 rounded-2xl p-8">
                    <span className="text-8xl">🃏</span>
                  </div>
                  <div className="mt-6 text-center relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {getRarityIcon(previewSkin.rarity)}
                      <h3 className="text-2xl font-bold text-white">{previewSkin.name}</h3>
                    </div>
                    {previewSkin.cardName && (
                      <p className="text-amber-400 font-medium">
                        Carta: {previewSkin.cardName}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-3">
              {isOwned(previewSkin.id) ? (
                <button
                  onClick={() => {
                    handleEquip(previewSkin.id);
                    setPreviewSkin(null);
                  }}
                  disabled={isEquipped(previewSkin.id)}
                  className={`px-6 py-3 rounded-xl font-bold transition-colors ${
                    isEquipped(previewSkin.id)
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-violet-600 hover:bg-violet-500 text-white'
                  }`}
                >
                  {isEquipped(previewSkin.id) ? 'Già Equipaggiata' : 'Equipaggia'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    handlePurchase(previewSkin.id);
                    setPreviewSkin(null);
                  }}
                  disabled={userRankiards < previewSkin.price}
                  className={`px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 ${
                    userRankiards >= previewSkin.price
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  Acquista per {previewSkin.price} Rankiard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
