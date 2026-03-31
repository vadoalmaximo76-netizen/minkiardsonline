import React, { useState } from 'react';

interface SfaccimmCard {
  id: string;
  name: string;
  type: string;
  frontImage: string;
  pti?: number;
  stars?: number;
  deckKey: string;
}

interface SfaccimmSelectOverlayProps {
  cards: SfaccimmCard[];
  maxSelect: number;
  selected: string[];
  submitting: boolean;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  bonus: 'Bonus',
  mosse: 'Mosse',
  personaggi: 'Personaggi',
  personaggi_speciali: 'Personaggi Speciali',
};

const SfaccimmSelectOverlay: React.FC<SfaccimmSelectOverlayProps> = ({
  cards,
  maxSelect,
  selected,
  submitting,
  onToggle,
  onConfirm,
  onCancel
}) => {
  const [filter, setFilter] = useState<string>('all');

  const filteredCards = filter === 'all' ? cards : cards.filter(c => c.deckKey === filter || c.type === filter);
  const deckKeys = Array.from(new Set(cards.map(c => c.deckKey)));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.90)' }}>
      <div className="relative w-full max-w-4xl mx-2 sm:mx-4">
        <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-2 border-red-500/50 rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl sm:text-2xl font-black text-red-400" style={{ textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>
              🤌 SFACCIMM!
            </h2>
            <div className="text-right">
              <span className={`text-lg font-black ${selected.length >= maxSelect ? 'text-red-400' : 'text-white'}`}>
                {selected.length}/{maxSelect}
              </span>
              <p className="text-white/50 text-xs">carte selezionate</p>
            </div>
          </div>
          <p className="text-red-200/70 text-xs sm:text-sm mb-3 text-center">
            Seleziona esattamente {maxSelect} carte da eliminare definitivamente dai mazzi
          </p>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-3 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${filter === 'all' ? 'bg-red-600 text-white' : 'bg-slate-700 text-white/70 hover:bg-slate-600'}`}
            >
              Tutti ({cards.length})
            </button>
            {deckKeys.map(dk => (
              <button
                key={dk}
                onClick={() => setFilter(dk)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${filter === dk ? 'bg-red-600 text-white' : 'bg-slate-700 text-white/70 hover:bg-slate-600'}`}
              >
                {TYPE_LABELS[dk] || dk} ({cards.filter(c => c.deckKey === dk).length})
              </button>
            ))}
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[50vh] overflow-y-auto">
            {filteredCards.map(card => {
              const isSelected = selected.includes(card.id);
              const isDisabled = submitting || (!isSelected && selected.length >= maxSelect);
              return (
                <div
                  key={card.id}
                  onClick={() => !isDisabled && onToggle(card.id)}
                  className={`relative cursor-pointer rounded-lg border-2 transition-all p-1 ${
                    isSelected
                      ? 'border-red-400 bg-red-900/30 scale-95'
                      : isDisabled
                        ? 'border-transparent opacity-40 cursor-not-allowed'
                        : 'border-transparent hover:border-red-400/50 bg-black/20 hover:scale-105'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 z-10 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="text-white text-xs font-black">✓</span>
                    </div>
                  )}
                  {card.frontImage ? (
                    <img
                      src={card.frontImage}
                      alt={card.name || 'Card'}
                      className="w-full h-24 object-cover rounded"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-24 bg-slate-700 rounded flex items-center justify-center">
                      <span className="text-2xl">🃏</span>
                    </div>
                  )}
                  <p className="text-white text-[9px] text-center mt-1 truncate leading-tight">
                    {card.name || TYPE_LABELS[card.type] || card.type}
                  </p>
                  <p className="text-white/40 text-[8px] text-center">
                    {TYPE_LABELS[card.deckKey] || card.deckKey}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors"
            >
              ANNULLA
            </button>
            <button
              onClick={onConfirm}
              disabled={selected.length !== maxSelect || submitting}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-3 rounded-lg transition-colors"
            >
              {submitting
                ? 'Invio...'
                : selected.length === maxSelect
                  ? `ELIMINA (${selected.length})`
                  : `Seleziona ancora ${maxSelect - selected.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SfaccimmSelectOverlay;
