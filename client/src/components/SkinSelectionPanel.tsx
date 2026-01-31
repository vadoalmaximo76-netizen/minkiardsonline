import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Lock, Sparkles, Star, Crown, Palette, Check } from 'lucide-react';

interface CardSkin {
  id: number;
  name: string;
  cardName: string | null;
  description: string | null;
  skinImageUrl: string | null;
  rarity: string;
  price: number;
}

interface PlayerSkin {
  id: number;
  skinId: number;
  isEquipped: boolean;
}

interface SkinSelectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  cardName: string;
  cardId: string;
  currentImage: string;
  onSkinSelect: (skinImageUrl: string | null, skinId: number | null, rarity: string) => void;
  authToken: string | null;
}

export function SkinSelectionPanel({ 
  isOpen, 
  onClose, 
  cardName, 
  cardId,
  currentImage,
  onSkinSelect,
  authToken 
}: SkinSelectionPanelProps) {
  const [availableSkins, setAvailableSkins] = useState<CardSkin[]>([]);
  const [ownedSkinIds, setOwnedSkinIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkinId, setSelectedSkinId] = useState<number | null>(null);
  const [applyingAnimation, setApplyingAnimation] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSkinsForCard();
    }
  }, [isOpen, cardName]);

  const fetchSkinsForCard = async () => {
    setLoading(true);
    try {
      const [skinsRes, ownedRes] = await Promise.all([
        fetch('/api/card-skins'),
        authToken ? fetch('/api/card-skins/owned', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }) : Promise.resolve({ ok: false, json: () => Promise.resolve({ skins: [] }) })
      ]);

      if (skinsRes.ok) {
        const skinsData = await skinsRes.json();
        const cardSkins = skinsData.skins.filter((s: CardSkin) => 
          s.cardName && s.cardName.toUpperCase() === cardName.toUpperCase()
        );
        setAvailableSkins(cardSkins);
      }

      if (ownedRes.ok) {
        const ownedData = await ownedRes.json();
        setOwnedSkinIds(ownedData.skins?.map((s: PlayerSkin) => s.skinId) || []);
      }
    } catch (error) {
      console.error('Failed to fetch skins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSkin = (skin: CardSkin) => {
    if (!ownedSkinIds.includes(skin.id)) {
      return;
    }

    setSelectedSkinId(skin.id);
    setApplyingAnimation(skin.rarity);

    setTimeout(() => {
      onSkinSelect(skin.skinImageUrl, skin.id, skin.rarity);
      setApplyingAnimation(null);
      onClose();
    }, 1500);
  };

  const handleResetToOriginal = () => {
    setSelectedSkinId(null);
    setApplyingAnimation('reset');
    
    setTimeout(() => {
      onSkinSelect(null, null, 'reset');
      setApplyingAnimation(null);
      onClose();
    }, 800);
  };

  const getRarityStyles = (rarity: string, isOwned: boolean) => {
    const baseOpacity = isOwned ? '1' : '0.4';
    
    switch (rarity) {
      case 'legendary':
        return {
          border: `3px solid ${isOwned ? '#fbbf24' : '#6b7280'}`,
          boxShadow: isOwned ? '0 0 20px rgba(251, 191, 36, 0.5), inset 0 0 15px rgba(251, 191, 36, 0.2)' : 'none',
          background: isOwned ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))' : 'rgba(55, 65, 81, 0.5)',
          opacity: baseOpacity
        };
      case 'epic':
        return {
          border: `3px solid ${isOwned ? '#a855f7' : '#6b7280'}`,
          boxShadow: isOwned ? '0 0 15px rgba(168, 85, 247, 0.4)' : 'none',
          background: isOwned ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.1))' : 'rgba(55, 65, 81, 0.5)',
          opacity: baseOpacity
        };
      case 'rare':
        return {
          border: `3px solid ${isOwned ? '#3b82f6' : '#6b7280'}`,
          boxShadow: isOwned ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none',
          background: isOwned ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.1))' : 'rgba(55, 65, 81, 0.5)',
          opacity: baseOpacity
        };
      default:
        return {
          border: `2px solid ${isOwned ? '#9ca3af' : '#4b5563'}`,
          boxShadow: 'none',
          background: isOwned ? 'rgba(156, 163, 175, 0.1)' : 'rgba(55, 65, 81, 0.5)',
          opacity: baseOpacity
        };
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

  const getAnimationClass = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'animate-legendary-skin';
      case 'epic': return 'animate-epic-skin';
      case 'rare': return 'animate-rare-skin';
      case 'reset': return 'animate-reset-skin';
      default: return 'animate-common-skin';
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[2147483647] p-4"
      onClick={onClose}
    >
      <style>{`
        @keyframes legendary-skin-apply {
          0% { transform: scale(1); filter: brightness(1); }
          25% { transform: scale(1.1); filter: brightness(2) drop-shadow(0 0 30px gold); }
          50% { transform: scale(1.15) rotate(5deg); filter: brightness(2.5) drop-shadow(0 0 50px gold) drop-shadow(0 0 80px orange); }
          75% { transform: scale(1.1) rotate(-3deg); filter: brightness(2) drop-shadow(0 0 40px gold); }
          100% { transform: scale(1); filter: brightness(1.2) drop-shadow(0 0 20px gold); }
        }
        @keyframes epic-skin-apply {
          0% { transform: scale(1); filter: brightness(1); }
          30% { transform: scale(1.1); filter: brightness(1.8) drop-shadow(0 0 25px purple); }
          60% { transform: scale(1.12); filter: brightness(2) drop-shadow(0 0 40px purple); }
          100% { transform: scale(1); filter: brightness(1.1) drop-shadow(0 0 15px purple); }
        }
        @keyframes rare-skin-apply {
          0% { transform: scale(1); filter: brightness(1); }
          40% { transform: scale(1.08); filter: brightness(1.5) drop-shadow(0 0 20px blue); }
          100% { transform: scale(1); filter: brightness(1.1) drop-shadow(0 0 10px blue); }
        }
        @keyframes common-skin-apply {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes reset-skin-apply {
          0% { transform: scale(1); filter: grayscale(0); }
          50% { transform: scale(0.95); filter: grayscale(1); }
          100% { transform: scale(1); filter: grayscale(0); }
        }
        .animate-legendary-skin { animation: legendary-skin-apply 1.5s ease-in-out; }
        .animate-epic-skin { animation: epic-skin-apply 1.2s ease-in-out; }
        .animate-rare-skin { animation: rare-skin-apply 1s ease-in-out; }
        .animate-common-skin { animation: common-skin-apply 0.6s ease-in-out; }
        .animate-reset-skin { animation: reset-skin-apply 0.8s ease-in-out; }
      `}</style>

      <div 
        className="bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden border-2 border-violet-500/50"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Scegli Skin - {cardName}
          </h2>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {applyingAnimation && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className={`${getAnimationClass(applyingAnimation)} p-4`}>
                <img 
                  src={selectedSkinId ? availableSkins.find(s => s.id === selectedSkinId)?.skinImageUrl || currentImage : currentImage}
                  alt="Applying skin"
                  className="w-48 h-64 object-cover rounded-xl"
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <button
              onClick={handleResetToOriginal}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <X className="w-5 h-5" />
              Usa Carta Originale
            </button>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-8">
              Caricamento skin...
            </div>
          ) : availableSkins.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Palette className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nessuna skin disponibile per questa carta.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {availableSkins.map(skin => {
                const isOwned = ownedSkinIds.includes(skin.id);
                const styles = getRarityStyles(skin.rarity, isOwned);

                return (
                  <div
                    key={skin.id}
                    onClick={() => handleSelectSkin(skin)}
                    className={`relative rounded-xl p-3 transition-all duration-300 ${
                      isOwned ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'
                    }`}
                    style={styles}
                  >
                    {!isOwned && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center z-10">
                        <Lock className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-gray-300 text-xs font-bold text-center px-2">
                          SKIN DA SBLOCCARE
                        </span>
                        <span className="text-amber-400 text-xs mt-1">
                          {skin.price} R
                        </span>
                      </div>
                    )}

                    <div className="relative">
                      {skin.skinImageUrl ? (
                        <img 
                          src={skin.skinImageUrl}
                          alt={skin.name}
                          className="w-full h-40 object-cover rounded-lg"
                          style={{ filter: isOwned ? 'none' : 'grayscale(80%)' }}
                        />
                      ) : (
                        <div className="w-full h-40 bg-gray-700 rounded-lg flex items-center justify-center">
                          <Palette className="w-10 h-10 text-gray-500" />
                        </div>
                      )}

                      {isOwned && selectedSkinId === skin.id && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center gap-1">
                        {getRarityIcon(skin.rarity)}
                        <span className={`font-bold text-sm ${isOwned ? 'text-white' : 'text-gray-500'}`}>
                          {skin.name}
                        </span>
                      </div>
                      {skin.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {skin.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
