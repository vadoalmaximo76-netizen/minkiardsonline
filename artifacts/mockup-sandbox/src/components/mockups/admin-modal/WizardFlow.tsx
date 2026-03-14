import { useState } from "react";
import { ChevronRight, ChevronLeft, Users, Sword, Star, Zap, Search, Save, Wand2, Volume2, Video, Trash2, Check } from "lucide-react";

const DECKS = [
  { id: "personaggi", label: "Personaggi", icon: Users, color: "bg-blue-600", glow: "shadow-blue-500/30", desc: "Carta personaggio con PTI e stelle" },
  { id: "mosse", label: "Mosse", icon: Sword, color: "bg-red-600", glow: "shadow-red-500/30", desc: "Mossa d'attacco o difesa" },
  { id: "bonus", label: "Bonus", icon: Star, color: "bg-gray-600", glow: "shadow-gray-500/30", desc: "Carta effetto speciale bonus" },
  { id: "speciali", label: "Speciali", icon: Zap, color: "bg-yellow-500", glow: "shadow-yellow-500/30", desc: "Personaggio con abilità speciale" },
];

const CARDS = [
  { id: 1, name: "Marco Rossi", pti: 320, stars: 4, color: "#2563eb" },
  { id: 2, name: "Giulia Ferrari", pti: 180, stars: 2, color: "#7c3aed" },
  { id: 3, name: "Luca Bianchi", pti: 450, stars: 5, color: "#059669" },
  { id: 4, name: "Sofia Conti", pti: 220, stars: 3, color: "#dc2626" },
  { id: 5, name: "Andrea Ricci", pti: 110, stars: 1, color: "#d97706" },
  { id: 6, name: "Elena Marino", pti: 390, stars: 4, color: "#0891b2" },
  { id: 7, name: "Dario Bruno", pti: 270, stars: 3, color: "#9333ea" },
];

const STEPS = ["Mazzo", "Carta", "Modifica"];

export function WizardFlow() {
  const [step, setStep] = useState(1);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);

  const deck = DECKS.find(d => d.id === selectedDeck);
  const card = CARDS.find(c => c.id === selectedCard);
  const filtered = CARDS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleDeckSelect = (id: string) => {
    setSelectedDeck(id);
    setTimeout(() => setStep(2), 300);
  };

  const handleCardSelect = (id: number) => {
    setSelectedCard(id);
    setTimeout(() => setStep(3), 300);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans overflow-hidden">

      {/* Progress header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 bg-gray-950/60 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-white">Gestione Carte</h1>
          <span className="text-gray-600 text-xs">Admin</span>
        </div>

        {/* Breadcrumb steps */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const num = i + 1;
            const isActive = step === num;
            const isDone = step > num;
            const isReachable = (num === 1) || (num === 2 && selectedDeck) || (num === 3 && selectedCard);

            return (
              <div key={s} className="flex items-center">
                <button
                  onClick={() => isReachable ? setStep(num) : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/15 text-white"
                      : isDone
                      ? "text-green-400 cursor-pointer hover:text-green-300"
                      : "text-gray-600"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone ? "bg-green-500 text-white" : isActive ? "bg-white text-gray-900" : "bg-gray-700 text-gray-500"
                  }`}>
                    {isDone ? <Check size={10} /> : num}
                  </div>
                  {s}
                  {isDone && deck && num === 1 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${deck.color}`}>{deck.label}</span>
                  )}
                  {isDone && card && num === 2 && (
                    <span className="text-[10px] text-gray-400 truncate max-w-20">{card.name}</span>
                  )}
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight size={14} className="text-gray-700 mx-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">

        {/* Step 1: Scegli mazzo */}
        {step === 1 && (
          <div className="p-8">
            <p className="text-gray-400 text-sm mb-6">Quale tipo di carte vuoi gestire?</p>
            <div className="grid grid-cols-2 gap-4">
              {DECKS.map(d => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleDeckSelect(d.id)}
                    className={`relative p-5 rounded-2xl border text-left transition-all group hover:scale-[1.02] ${
                      selectedDeck === d.id
                        ? `${d.color} border-transparent shadow-lg ${d.glow}`
                        : "bg-gray-800/60 border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      selectedDeck === d.id ? "bg-white/20" : d.color
                    }`}>
                      <Icon size={20} />
                    </div>
                    <h3 className="text-white font-bold text-base mb-1">{d.label}</h3>
                    <p className="text-white/60 text-xs">{d.desc}</p>
                    {selectedDeck === d.id && (
                      <div className="absolute top-3 right-3">
                        <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Scegli carta */}
        {step === 2 && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <p className="text-gray-400 text-sm flex-1">Seleziona la carta da modificare in</p>
              {deck && (
                <span className={`text-xs font-bold text-white px-3 py-1 rounded-full ${deck.color}`}>{deck.label}</span>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cerca carta per nome..."
                className="w-full bg-gray-800 text-white border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Card list */}
            <div className="space-y-2">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleCardSelect(c.id)}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                    selectedCard === c.id
                      ? "border-blue-500/60 bg-blue-600/10"
                      : "border-white/10 bg-gray-800/50 hover:border-white/25 hover:bg-gray-800"
                  }`}
                >
                  {/* Card visual */}
                  <div
                    className="w-12 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-white/50 text-2xl font-black"
                    style={{ background: `linear-gradient(135deg, ${c.color}88, ${c.color}22)` }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{c.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      PTI {c.pti} · {"★".repeat(c.stars)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="mt-6 flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm transition-all"
            >
              <ChevronLeft size={14} />
              Cambia mazzo
            </button>
          </div>
        )}

        {/* Step 3: Edit form */}
        {step === 3 && card && (
          <div className="p-6">
            {/* Card preview */}
            <div className="flex items-center gap-4 mb-6 bg-gray-800/60 rounded-2xl p-4 border border-white/10">
              <div
                className="w-16 h-20 rounded-xl flex-shrink-0 flex items-center justify-center text-white/40 text-3xl font-black"
                style={{ background: `linear-gradient(135deg, ${card.color}99, ${card.color}22)` }}
              >
                {card.name.charAt(0)}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{card.name}</p>
                <p className="text-gray-400 text-sm">PTI {card.pti} · {"★".repeat(card.stars)}</p>
                {deck && <span className={`mt-1 inline-block text-xs font-bold text-white px-2 py-0.5 rounded ${deck.color}`}>{deck.label}</span>}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block font-medium">Nome carta</label>
                <input
                  defaultValue={card.name}
                  className="w-full bg-gray-800 text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block font-medium">PTI</label>
                  <input defaultValue={card.pti} type="number" className="w-full bg-gray-800 text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block font-medium">Stelle</label>
                  <input defaultValue={card.stars} type="number" className="w-full bg-gray-800 text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1.5 font-medium">
                  <span className="text-purple-400">✦</span> Effetto (AI)
                </label>
                <div className="flex gap-2">
                  <textarea
                    rows={3}
                    placeholder="Descrivi l'effetto speciale della carta..."
                    className="flex-1 bg-gray-800 text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-500/50"
                  />
                  <button className="bg-purple-700 hover:bg-purple-600 text-white px-3 rounded-xl flex items-center gap-1 self-start py-2.5 text-sm transition-all">
                    <Wand2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1.5 font-medium">
                    <Volume2 size={11} className="text-cyan-400" /> Audio URL
                  </label>
                  <input placeholder="https://..." className="w-full bg-gray-800 text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1.5 font-medium">
                    <Video size={11} className="text-red-400" /> YouTube
                  </label>
                  <input placeholder="https://youtu.be/..." className="w-full bg-gray-800 text-white border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                  saved ? "bg-green-600 text-white" : "bg-green-700 hover:bg-green-600 text-white"
                }`}
              >
                {saved ? <><Check size={14} />Salvato!</> : <><Save size={14} />Salva Modifiche</>}
              </button>
              <button
                onClick={() => setStep(2)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-3 rounded-xl text-sm transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <button className="bg-red-900/40 hover:bg-red-900 text-red-400 hover:text-red-200 border border-red-700/30 px-4 py-3 rounded-xl text-sm transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
