import React, { useState } from 'react';

interface CharInfo {
  id: string;
  name: string;
  image: string;
  currentOwner: string;
}

interface TangramAssignOverlayProps {
  chars: CharInfo[];
  players: string[];
  onConfirm: (assignments: { [charId: string]: string }) => void;
  onCancel: () => void;
}

const TangramAssignOverlay: React.FC<TangramAssignOverlayProps> = ({ chars, players, onConfirm, onCancel }) => {
  const [assignments, setAssignments] = useState<{ [charId: string]: string }>(() => {
    const init: { [charId: string]: string } = {};
    chars.forEach(c => { init[c.id] = c.currentOwner; });
    return init;
  });

  const allAssigned = chars.every(c => assignments[c.id]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}>
      <div className="relative w-full max-w-2xl mx-2 sm:mx-4">
        <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-2 border-purple-500/50 rounded-2xl p-4 sm:p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
          <h2 className="text-xl sm:text-2xl font-black text-purple-400 text-center mb-1" style={{ textShadow: '0 0 20px rgba(168,85,247,0.5)' }}>
            🧩 TANGRAM
          </h2>
          <p className="text-purple-200/70 text-center text-xs sm:text-sm mb-4">
            Assegna ogni personaggio in campo al giocatore di tua scelta
          </p>

          <div className="flex flex-col gap-3">
            {chars.map(char => (
              <div key={char.id} className="flex items-center gap-3 bg-black/30 rounded-xl p-3 border border-purple-500/20">
                <div className="flex-shrink-0">
                  {char.image ? (
                    <img
                      src={char.image}
                      alt={char.name}
                      className="w-14 h-20 object-cover rounded-lg border border-purple-400/30"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-14 h-20 bg-purple-900/40 rounded-lg border border-purple-400/30 flex items-center justify-center">
                      <span className="text-2xl">🧩</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{char.name || char.id}</p>
                  <p className="text-purple-300/60 text-xs mt-0.5">
                    Attuale: <span className="text-purple-300 font-medium">{char.currentOwner}</span>
                  </p>
                  <div className="mt-2">
                    <select
                      value={assignments[char.id] || ''}
                      onChange={e => setAssignments(prev => ({ ...prev, [char.id]: e.target.value }))}
                      className="w-full bg-slate-800 border border-purple-500/40 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-purple-400"
                    >
                      <option value="">-- Scegli giocatore --</option>
                      {players.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={onCancel}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors"
            >
              ANNULLA
            </button>
            <button
              onClick={() => { if (allAssigned) onConfirm(assignments); }}
              disabled={!allAssigned}
              className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-3 rounded-lg transition-colors"
            >
              CONFERMA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TangramAssignOverlay;
