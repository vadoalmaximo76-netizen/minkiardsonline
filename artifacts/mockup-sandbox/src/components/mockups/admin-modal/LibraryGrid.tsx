import { useState } from "react";
import { Search, Plus, Save, Trash2, Wand2, Volume2, Video, Filter, X, LayoutGrid } from "lucide-react";

const DECKS = [
  { id: "personaggi", label: "Personaggi", color: "bg-blue-600", pill: "bg-blue-600/20 text-blue-300 border-blue-500/40" },
  { id: "mosse", label: "Mosse", color: "bg-red-600", pill: "bg-red-600/20 text-red-300 border-red-500/40" },
  { id: "bonus", label: "Bonus", color: "bg-gray-600", pill: "bg-gray-600/20 text-gray-300 border-gray-500/40" },
  { id: "speciali", label: "Speciali", color: "bg-yellow-500", pill: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" },
];

const TABS = ["Aggiungi", "Gestione", "Esistenti"];

const CARDS = [
  { id: 1, name: "Marco Rossi", pti: 320, stars: 4, color: "#2563eb", effect: "Attacco doppio se ≥ 3 stelle" },
  { id: 2, name: "Giulia Ferrari", pti: 180, stars: 2, color: "#7c3aed", effect: "Cura 50 PTI al turno" },
  { id: 3, name: "Luca Bianchi", pti: 450, stars: 5, color: "#059669", effect: "Immunità danni per 1 turno" },
  { id: 4, name: "Sofia Conti", pti: 220, stars: 3, color: "#dc2626", effect: "Teletrasporto: evita prossimo attacco" },
  { id: 5, name: "Andrea Ricci", pti: 110, stars: 1, color: "#d97706", effect: null },
  { id: 6, name: "Elena Marino", pti: 390, stars: 4, color: "#0891b2", effect: "Scudo: assorbe 150 danni" },
  { id: 7, name: "Dario Bruno", pti: 270, stars: 3, color: "#9333ea", effect: "Contrattacco automatico" },
  { id: 8, name: "Vera Amato", pti: 340, stars: 4, color: "#be185d", effect: null },
  { id: 9, name: "Max Leone", pti: 500, stars: 5, color: "#065f46", effect: "Morte istantanea se < 100 PTI" },
];

export function LibraryGrid() {
  const [selectedDeck, setSelectedDeck] = useState("personaggi");
  const [activeTab, setActiveTab] = useState("Gestione");
  const [selectedCard, setSelectedCard] = useState<number | null>(3);
  const [search, setSearch] = useState("");

  const deck = DECKS.find(d => d.id === selectedDeck)!;
  const filtered = CARDS.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const card = CARDS.find(c => c.id === selectedCard);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans overflow-hidden">

      {/* Top toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-950/80 border-b border-white/10 flex-shrink-0">
        {/* Title */}
        <div className="flex items-center gap-2 mr-2">
          <LayoutGrid size={16} className="text-purple-400" />
          <span className="text-sm font-bold text-white">Gestione Carte</span>
        </div>

        {/* Deck pills */}
        <div className="flex items-center gap-1.5">
          {DECKS.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDeck(d.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                selectedDeck === d.id ? `${d.color} text-white border-transparent` : d.pill
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-white/10" />

        {/* Tab pills */}
        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                activeTab === t ? "bg-white/15 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca carta..."
            className="bg-gray-800 text-white text-xs pl-8 pr-3 py-1.5 rounded-lg border border-white/10 placeholder-gray-600 focus:outline-none focus:border-white/30 w-40"
          />
        </div>

        <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
          <Plus size={12} />
          Aggiungi
        </button>
      </div>

      {/* Main content: grid + side panel */}
      <div className="flex flex-1 min-h-0">

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCard(c.id)}
                className={`relative rounded-xl border text-left transition-all group overflow-hidden ${
                  selectedCard === c.id
                    ? "border-blue-500 shadow-lg shadow-blue-500/20"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                {/* Card image area */}
                <div
                  className="h-32 flex items-center justify-center relative"
                  style={{ background: `linear-gradient(135deg, ${c.color}88, ${c.color}22)` }}
                >
                  <span className="text-5xl font-black text-white/30">{c.name.charAt(0)}</span>
                  {selectedCard === c.id && (
                    <div className="absolute inset-0 ring-2 ring-inset ring-blue-500/60 rounded-t-xl" />
                  )}
                  {/* Stars overlay */}
                  <div className="absolute bottom-2 right-2 flex gap-0.5">
                    {Array.from({ length: c.stars }).map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-yellow-400 shadow" />
                    ))}
                  </div>
                </div>

                {/* Card info */}
                <div className="p-2.5 bg-gray-800/80">
                  <p className="text-white text-xs font-bold truncate">{c.name}</p>
                  <p className="text-blue-300 text-[10px] mt-0.5">PTI {c.pti}</p>
                  {c.effect && (
                    <p className="text-purple-400 text-[9px] mt-1 truncate">{c.effect}</p>
                  )}
                </div>
              </button>
            ))}

            {/* Add new card tile */}
            <button className="rounded-xl border border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center gap-2 h-48 text-gray-600 hover:text-gray-400 transition-all">
              <Plus size={24} />
              <span className="text-xs">Nuova carta</span>
            </button>
          </div>
        </div>

        {/* Side panel: edit form */}
        <div className="w-72 flex-shrink-0 border-l border-white/10 flex flex-col bg-gray-900/60">
          {card ? (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 flex-shrink-0">
                <div
                  className="w-8 h-10 rounded flex items-center justify-center text-white font-black flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${card.color}cc, ${card.color}44)` }}
                >
                  {card.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{card.name}</p>
                  <p className="text-blue-300 text-[10px]">PTI {card.pti} · ★{card.stars}</p>
                </div>
                <button onClick={() => setSelectedCard(null)} className="text-gray-600 hover:text-gray-400">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div>
                  <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 block">Nome</label>
                  <input
                    defaultValue={card.name}
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 block">PTI</label>
                    <input defaultValue={card.pti} type="number" className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 block">Stelle</label>
                    <input defaultValue={card.stars} type="number" className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1 block">
                    <span className="text-purple-400">✦</span> Effetto
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      rows={3}
                      defaultValue={card.effect || ""}
                      placeholder="Descrivi l'effetto..."
                      className="flex-1 bg-gray-800 text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                    />
                    <button className="bg-purple-700/60 hover:bg-purple-700 text-purple-200 px-1.5 rounded-lg self-start py-1.5 text-xs transition-all">
                      <Wand2 size={11} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1 block">
                    <Volume2 size={9} className="text-cyan-400" /> Audio
                  </label>
                  <input placeholder="https://..." className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1 block">
                    <Video size={9} className="text-red-400" /> YouTube
                  </label>
                  <input placeholder="https://youtu.be/..." className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none" />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-white/10 space-y-2 flex-shrink-0">
                <button className="w-full flex items-center justify-center gap-1.5 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-medium transition-all">
                  <Save size={11} />Salva Modifiche
                </button>
                <button className="w-full flex items-center justify-center gap-1.5 bg-red-900/40 hover:bg-red-900 text-red-400 hover:text-red-200 border border-red-700/30 py-2 rounded-lg text-xs transition-all">
                  <Trash2 size={11} />Elimina Carta
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-700 gap-2 px-4 text-center">
              <Filter size={28} className="opacity-30" />
              <p className="text-xs">Seleziona una carta dalla griglia per modificarla</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
