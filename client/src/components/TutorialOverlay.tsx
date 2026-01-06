import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  highlightSelector?: string;
  position: "center" | "top" | "bottom" | "left" | "right";
  icon: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Benvenuto in MINKIARDS!",
    description: "Questo tutorial ti guiderà attraverso le basi del gioco. Imparerai a pescare carte, giocarle in campo e attaccare i tuoi avversari!",
    position: "center",
    icon: "🎮"
  },
  {
    id: "decks",
    title: "I Mazzi di Carte",
    description: "Ci sono 4 mazzi: PERSONAGGI (i tuoi combattenti), MOSSE (attacchi e abilità), BONUS (potenziamenti) e SPECIALI (personaggi rari). Clicca su un mazzo per pescare una carta!",
    highlightSelector: "[data-tutorial='decks']",
    position: "bottom",
    icon: "🃏"
  },
  {
    id: "hand",
    title: "Le Tue Carte in Mano",
    description: "Le carte che peschi vanno nella tua mano. Clicca sull'icona della mano per vedere tutte le tue carte. Da lì puoi giocarle in campo!",
    highlightSelector: "[data-tutorial='hand']",
    position: "top",
    icon: "✋"
  },
  {
    id: "play-card",
    title: "Giocare una Carta",
    description: "Clicca su una carta nella tua mano per aprire il menu. Premi 'GIOCA' per metterla in campo, oppure 'GIOCA COPERTA' per giocarla a faccia in giù!",
    position: "center",
    icon: "⬇️"
  },
  {
    id: "field",
    title: "Il Campo di Gioco",
    description: "Il tavolo rotondo al centro mostra tutte le carte in campo. Le tue carte appaiono in basso, quelle degli avversari intorno al tavolo.",
    highlightSelector: "[data-tutorial='field']",
    position: "top",
    icon: "🎯"
  },
  {
    id: "attack",
    title: "Attaccare con le MOSSE",
    description: "Quando hai una carta MOSSE in campo, vedrai il pulsante 'ATTACCA'. Cliccalo, seleziona i bersagli e inserisci il danno per attaccare!",
    position: "center",
    icon: "⚔️"
  },
  {
    id: "notes",
    title: "Annotazioni sulle Carte",
    description: "Sotto ogni carta c'è un campo di testo. Usalo per segnare i PTI (Punti Vita), le stelle o altre informazioni importanti!",
    position: "center",
    icon: "📝"
  },
  {
    id: "end-turn",
    title: "Fine Turno",
    description: "Quando hai finito le tue azioni, premi 'FINE TURNO' per passare al giocatore successivo. L'indicatore mostra sempre di chi è il turno!",
    highlightSelector: "[data-tutorial='end-turn']",
    position: "bottom",
    icon: "⏭️"
  },
  {
    id: "tools",
    title: "Strumenti Utili",
    description: "Usa il DADO per i tiri casuali, la CALCOLATRICE per i calcoli, il CIMITERO per vedere le carte eliminate e la CHAT per parlare con gli altri giocatori!",
    highlightSelector: "[data-tutorial='tools']",
    position: "left",
    icon: "🛠️"
  },
  {
    id: "ready",
    title: "Sei Pronto!",
    description: "Ora conosci le basi di MINKIARDS! Ricorda: strategia, tempismo e un pizzico di fortuna sono la chiave per vincere. Buon divertimento!",
    position: "center",
    icon: "🏆"
  }
];

interface TutorialOverlayProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tutorialSteps.length - 1;

  useEffect(() => {
    // Add highlight class to target element
    if (step.highlightSelector) {
      const element = document.querySelector(step.highlightSelector);
      if (element) {
        element.classList.add("tutorial-highlight");
        return () => {
          element.classList.remove("tutorial-highlight");
        };
      }
    }
  }, [step.highlightSelector]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem("minkiards-tutorial-completed", "true");
    }
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem("minkiards-tutorial-completed", "true");
    }
    onSkip();
  };

  if (!isVisible) return null;

  const getPositionClasses = () => {
    switch (step.position) {
      case "top":
        return "top-8 left-1/2 -translate-x-1/2";
      case "bottom":
        return "bottom-8 left-1/2 -translate-x-1/2";
      case "left":
        return "left-8 top-1/2 -translate-y-1/2";
      case "right":
        return "right-8 top-1/2 -translate-y-1/2";
      default:
        return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark overlay - clicks are blocked to prevent accidental tutorial dismissal */}
      <div className="absolute inset-0 bg-black/70 pointer-events-auto" />
      
      {/* Tutorial card */}
      <div 
        className={`absolute ${getPositionClasses()} pointer-events-auto max-w-md w-[90vw] animate-in fade-in zoom-in-95 duration-300`}
      >
        <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border-2 border-purple-500/50 rounded-3xl p-6 shadow-2xl shadow-purple-900/50">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{step.icon}</span>
              <div>
                <h3 className="text-white font-bold text-xl">{step.title}</h3>
                <p className="text-purple-300 text-xs">
                  Passo {currentStep + 1} di {tutorialSteps.length}
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="text-white/50 hover:text-white transition-colors p-1"
              title="Salta tutorial"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-purple-900/50 rounded-full mb-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>

          {/* Description */}
          <p className="text-white/90 text-sm leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={handlePrev}
              disabled={isFirstStep}
              className="bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed"
              size="sm"
            >
              <ChevronLeft size={16} />
              Indietro
            </Button>

            <button
              onClick={handleSkip}
              className="text-purple-300 hover:text-white text-sm underline transition-colors"
            >
              Salta tutorial
            </button>

            <Button
              onClick={handleNext}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold"
              size="sm"
            >
              {isLastStep ? (
                <>
                  <Sparkles size={16} />
                  Inizia a giocare!
                </>
              ) : (
                <>
                  Avanti
                  <ChevronRight size={16} />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full animate-pulse" />
        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-purple-500 rounded-full animate-pulse delay-150" />
      </div>
    </div>
  );
};
