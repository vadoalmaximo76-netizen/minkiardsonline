import React, { useState, useEffect, useCallback } from "react";
import { X, Play } from "lucide-react";
import useNarrator from "../lib/stores/useNarrator";

interface NarratorVoiceSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export const NarratorVoiceSelector: React.FC<NarratorVoiceSelectorProps> = ({ visible, onClose }) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const selectedVoiceName = useNarrator(s => s.selectedVoiceName);
  const setSelectedVoiceName = useNarrator(s => s.setSelectedVoiceName);

  useEffect(() => {
    if (!visible) return;
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [visible]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const previewVoice = useCallback((voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Che mossa incredibile! La partita si accende!");
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    window.speechSynthesis.speak(utterance);
  }, []);

  const selectVoice = useCallback((voiceName: string) => {
    setSelectedVoiceName(voiceName);
  }, [setSelectedVoiceName]);

  if (!visible) return null;

  const italianVoices = voices.filter(v => v.lang.startsWith('it'));
  const otherVoices = voices.filter(v => !v.lang.startsWith('it'));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-md max-h-[70vh] bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-amber-400 font-semibold text-sm">🎙️ Voce Narratore</h3>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <button
            onClick={() => selectVoice('')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
              !selectedVoiceName ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="text-lg">🌐</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Automatica</div>
              <div className="text-xs text-white/40">Prima voce italiana disponibile</div>
            </div>
            {!selectedVoiceName && <span className="text-amber-400 text-xs">✓</span>}
          </button>

          {italianVoices.length > 0 && (
            <>
              <div className="text-xs text-white/40 uppercase tracking-wider px-1 pt-1">Voci Italiane</div>
              {italianVoices.map(voice => (
                <div key={voice.name} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all ${
                  selectedVoiceName === voice.name ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}>
                  <button
                    onClick={() => selectVoice(voice.name)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`text-sm font-medium truncate ${selectedVoiceName === voice.name ? 'text-amber-300' : 'text-white/70'}`}>
                      {voice.name}
                    </div>
                    <div className="text-xs text-white/40">{voice.lang}</div>
                  </button>
                  <button
                    onClick={() => previewVoice(voice)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-amber-500/30 text-white/60 hover:text-amber-300 transition-colors flex-shrink-0"
                    title="Anteprima"
                  >
                    <Play size={12} />
                  </button>
                  {selectedVoiceName === voice.name && <span className="text-amber-400 text-xs flex-shrink-0">✓</span>}
                </div>
              ))}
            </>
          )}

          {otherVoices.length > 0 && (
            <>
              <div className="text-xs text-white/40 uppercase tracking-wider px-1 pt-1">Altre Voci</div>
              {otherVoices.map(voice => (
                <div key={voice.name} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                  selectedVoiceName === voice.name ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}>
                  <button
                    onClick={() => selectVoice(voice.name)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className={`text-xs font-medium truncate ${selectedVoiceName === voice.name ? 'text-amber-300' : 'text-white/60'}`}>
                      {voice.name}
                    </div>
                    <div className="text-[10px] text-white/30">{voice.lang}</div>
                  </button>
                  <button
                    onClick={() => previewVoice(voice)}
                    className="p-1 rounded-lg bg-white/10 hover:bg-amber-500/30 text-white/60 hover:text-amber-300 transition-colors flex-shrink-0"
                    title="Anteprima"
                  >
                    <Play size={10} />
                  </button>
                  {selectedVoiceName === voice.name && <span className="text-amber-400 text-xs flex-shrink-0">✓</span>}
                </div>
              ))}
            </>
          )}

          {voices.length === 0 && (
            <div className="text-center text-white/40 text-sm py-6">
              Nessuna voce disponibile sul tuo dispositivo
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
