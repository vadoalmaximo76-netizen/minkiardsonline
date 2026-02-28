import React from 'react';
import { ArrowLeft, Shuffle, Clock, Swords, Star, Construction } from 'lucide-react';

interface DraftSectionProps {
  onBack: () => void;
  playerName: string;
}

export function DraftSection({ onBack, playerName }: DraftSectionProps) {
  return (
    <div className="min-h-screen bg-arena-deep flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 10%, rgba(88, 28, 135, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(30, 58, 138, 0.3) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 60%), linear-gradient(180deg, #03050d 0%, #070b1a 30%, #0a1028 60%, #060918 100%)'
      }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] animate-bg-float-1" style={{ background: 'radial-gradient(circle, #9333ea, transparent 65%)', opacity: 0.2, top: '10%', left: '10%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full blur-[100px] animate-bg-float-2" style={{ background: 'radial-gradient(circle, #3b82f6, transparent 65%)', opacity: 0.15, bottom: '15%', right: '10%' }} />
      </div>

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors z-10 group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Torna alla home</span>
      </button>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center mb-8 shadow-2xl shadow-teal-500/30">
          <Shuffle className="w-12 h-12 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 tracking-wider mb-4">
          Modalità Draft
        </h1>

        {/* Construction badge */}
        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-full px-5 py-2 mb-8">
          <Construction className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 font-semibold text-sm">In sviluppo</span>
        </div>

        <p className="text-white/70 text-lg leading-relaxed mb-10">
          Nella modalità Draft, ogni giocatore sceglie le proprie carte a turno da un pool comune prima che la partita inizi. Strategia e istinto si sfidano già prima del primo turno!
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
          {[
            {
              icon: Shuffle,
              title: 'Pool comune',
              desc: 'Tutte le carte vengono estratte casualmente in un pool condiviso',
              color: 'from-purple-600 to-indigo-600'
            },
            {
              icon: Clock,
              title: 'Turni di scelta',
              desc: 'Ogni giocatore ha 30 secondi per scegliere una carta dal pool',
              color: 'from-teal-600 to-cyan-600'
            },
            {
              icon: Swords,
              title: 'Poi si gioca',
              desc: 'Con il mazzo scelto si entra in partita contro gli altri',
              color: 'from-rose-600 to-pink-600'
            }
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`bg-gradient-to-br ${feature.color} rounded-2xl p-5 border border-white/10 text-left`}
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-white mb-1">{feature.title}</h3>
                <p className="text-white/70 text-sm">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Stars / coming soon */}
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Star className="w-4 h-4" />
          <span>Questa modalità verrà rilasciata in un aggiornamento futuro</span>
          <Star className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
