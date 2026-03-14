import { useState } from "react";
import { Search, Plus, Save, Trash2, Wand2, Volume2, Video, ChevronRight, Users, Sword, Star, Zap, Pencil, X, Settings } from "lucide-react";

const DECKS = [
  { id: "personaggi", label: "Personaggi", icon: Users, color: "bg-blue-600", border: "border-blue-500", dot: "bg-blue-400" },
  { id: "mosse", label: "Mosse", icon: Sword, color: "bg-red-600", border: "border-red-500", dot: "bg-red-400" },
  { id: "bonus", label: "Bonus", icon: Star, color: "bg-gray-700", border: "border-gray-500", dot: "bg-gray-400" },
  { id: "speciali", label: "Speciali", icon: Zap, color: "bg-yellow-500", border: "border-yellow-400", dot: "bg-yellow-400" },
];

const TABS = [
  { id: "add", label: "Aggiungi" },
  { id: "manage", label: "Gestione" },
  { id: "existing", label: "Esistenti" },
];

const MOCK_CARDS = [
  { id: 1, name: "Marco Rossi", pti: 320, stars: 4, deck: "personaggi", color: "#2563eb" },
  { id: 2, name: "Giulia Ferrari", pti: 180, stars: 2, deck: "personaggi", color: "#7c3aed" },
  { id: 3, name: "Luca Bianchi", pti: 450, stars: 5, deck: "personaggi", color: "#059669" },
  { id: 4, name: "Sofia Conti", pti: 220, stars: 3, deck: "personaggi", color: "#dc2626" },
  { id: 5, name: "Andrea Ricci", pti: 110, stars: 1, deck: "personaggi", color: "#d97706" },
  { id: 6, name: "Elena Marino", pti: 390, stars: 4, deck: "personaggi", color: "#0891b2" },
  { id: 7, name: "Dario Bruno", pti: 270, stars: 3, deck: "personaggi", color: "#9333ea" },
];

export function Cockpit() {
  const [selectedDeck, setSelectedDeck] = useState("personaggi");
  const [activeTab, setActiveTab] = useState("manage");
  const [selectedCard, setSelectedCard] = useState<number | null>(3);
  const [search, setSearch] = useState("");

  const deck = DECKS.find(d => d.id === selectedDeck)!;
  const filtered = MOCK_CARDS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const card = MOCK_CARDS.find(c => c.id === selectedCard);

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">

      {/* Column 1: Icon nav bar */}
      <div className="w-14 flex flex-col items-center py-3 gap-1 bg-gray-950 border-r border-white/10 flex-shrink-0">
        <div className="text-[10px] text-gray-600 font-bold tracking-widest mb-2 rotate-0">MAZZO</div>
        {DECKS.map(d => {
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDeck(d.id)}
              title={d.label}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                selectedDeck === d.id ? `${d.color} shadow-lg` : "text-gray-500 hover:bg-white/10"
              }`}
            >
              <Icon size={18} />
            </button>
          );
        })}

        <div className="h-px w-8 bg-white/10 my-3" />
        <div className="text-[10px] text-gray-600 font-bold tracking-widest mb-2">TAB</div>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            title={t.label}
            className={`w-10 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
              activeTab === t.id ? "bg-white/15 text-white" : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {t.label.slice(0, 3)}
          </button>
        ))}

        <div className="flex-1" />
        <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 hover:bg-white/10 hover:text-gray-300 transition-all">
          <Settings size={16} />
        </button>
      </div>

      {/* Column 2: Card list */}
      <div className="w-52 flex flex-col border-r border-white/10 flex-shrink-0 bg-gray-900">
        {/* List header */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded text-white ${deck.color}`}>{deck.label}</span>
            <span className="text-gray-500 text-xs">{filtered.length}</span>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca..."
              className="w-full bg-gray-800 text-white text-xs pl-7 pr-2 py-1.5 rounded-lg border border-white/10 placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        {/* Add button */}
        <button className="mx-3 mb-2 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-lg px-2 py-1.5 text-gray-400 hover:text-white transition-all text-xs">
          <Plus size={12} />
          <span>Nuova carta</span>
        </button>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCard(c.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 text-left transition-all hover:bg-white/5 ${
                selectedCard === c.id ? "bg-blue-600/15 border-l-2 border-l-blue-500" : ""
              }`}
            >
              {/* Card thumb */}
              <div
                className="w-7 h-9 rounded flex-shrink-0 flex items-center justify-center text-white text-[10px] font-black"
                style={{ background: `linear-gradient(135deg, ${c.color}cc, ${c.color}44)` }}
              >
                {c.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium truncate leading-tight">{c.name}</p>
                <p className="text-blue-300 text-[9px]">PTI {c.pti} · ★{c.stars}</p>
              </div>
              {selectedCard === c.id && <ChevronRight size={10} className="text-blue-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Column 3: Edit form */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {card ? (
          <>
            {/* Form header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 flex-shrink-0 bg-gray-900/80">
              <div
                className="w-10 h-13 rounded border-2 border-blue-500/60 flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${card.color}cc, ${card.color}22)`, height: "52px", width: "40px" }}
              >
                {card.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-white font-bold text-base leading-tight">{card.name}</h2>
                <span className="text-blue-400 text-xs bg-blue-600/20 px-2 py-0.5 rounded">Personaggio</span>
              </div>
              <button className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/10 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nome carta</label>
                <input
                  defaultValue={card.name}
                  className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">PTI</label>
                  <input
                    defaultValue={card.pti}
                    type="number"
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Stelle</label>
                  <input
                    defaultValue={card.stars}
                    type="number"
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                  <span className="text-purple-400">✦</span> Effetto (AI)
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={3}
                    defaultValue="Quando attacca infligge danno × stelle. Può contrattaccare se l'avversario è a ≤ 2 stelle."
                    className="flex-1 bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500/50"
                  />
                  <button className="bg-purple-700 hover:bg-purple-600 text-white px-3 rounded-lg flex items-center gap-1 self-start py-2 text-xs transition-all">
                    <Wand2 size={12} />AI
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                    <Volume2 size={10} className="text-cyan-400" />Audio
                  </label>
                  <input
                    placeholder="https://..."
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                    <Video size={10} className="text-red-400" />YouTube
                  </label>
                  <input
                    placeholder="https://youtu.be/..."
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
            </div>

            {/* Form footer */}
            <div className="px-5 py-3 border-t border-white/10 flex gap-2 flex-shrink-0 bg-gray-900/80">
              <button className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                <Save size={13} />Salva
              </button>
              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-all">
                Annulla
              </button>
              <button className="ml-auto flex items-center gap-1.5 bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-white border border-red-700/50 px-4 py-2 rounded-lg text-sm transition-all">
                <Trash2 size={13} />Elimina
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
            <Pencil size={40} className="opacity-20" />
            <p className="text-sm">Seleziona una carta per modificarla</p>
          </div>
        )}
      </div>
    </div>
  );
}
