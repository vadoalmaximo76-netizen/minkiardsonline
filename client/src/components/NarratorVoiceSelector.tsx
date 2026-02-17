import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Play, Cloud, Monitor, Square } from "lucide-react";
import useNarrator, { type VoiceType } from "../lib/stores/useNarrator";

interface CloudVoice {
  name: string;
  label: string;
  lang: string;
  gender: string;
}

interface NarratorVoiceSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export const NarratorVoiceSelector: React.FC<NarratorVoiceSelectorProps> = ({ visible, onClose }) => {
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cloudVoices, setCloudVoices] = useState<CloudVoice[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedVoiceName = useNarrator(s => s.selectedVoiceName);
  const selectedVoiceType = useNarrator(s => s.selectedVoiceType);
  const setSelectedVoice = useNarrator(s => s.setSelectedVoice);

  useEffect(() => {
    if (!visible) return;
    const loadDeviceVoices = () => {
      if ('speechSynthesis' in window) {
        const available = window.speechSynthesis.getVoices();
        setDeviceVoices(available);
      }
    };
    loadDeviceVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadDeviceVoices;
    }

    fetch('/api/tts/voices')
      .then(r => r.json())
      .then(data => setCloudVoices(data))
      .catch(() => setCloudVoices([]));

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [visible]);

  const handleClose = useCallback(() => {
    stopPreview();
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewPlaying(null);
  }, []);

  const previewDeviceVoice = useCallback((voice: SpeechSynthesisVoice) => {
    stopPreview();
    setPreviewPlaying('device:' + voice.name);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Che mossa incredibile! La partita si accende!");
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    utterance.onend = () => setPreviewPlaying(null);
    utterance.onerror = () => setPreviewPlaying(null);
    window.speechSynthesis.speak(utterance);
  }, [stopPreview]);

  const previewCloudVoice = useCallback(async (voice: CloudVoice) => {
    stopPreview();
    setPreviewPlaying('cloud:' + voice.name);
    try {
      const response = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: "Che mossa incredibile! La partita si accende!", voice: voice.name }),
      });
      if (!response.ok) throw new Error('TTS failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPreviewPlaying(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPreviewPlaying(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch {
      setPreviewPlaying(null);
    }
  }, [stopPreview]);

  const selectVoice = useCallback((name: string, type: VoiceType) => {
    setSelectedVoice(name, type);
  }, [setSelectedVoice]);

  if (!visible) return null;

  const italianDeviceVoices = deviceVoices.filter(v => v.lang.startsWith('it'));
  const otherDeviceVoices = deviceVoices.filter(v => !v.lang.startsWith('it'));
  const italianCloudVoices = cloudVoices.filter(v => v.lang.startsWith('it'));
  const otherCloudVoices = cloudVoices.filter(v => !v.lang.startsWith('it'));

  const isSelected = (name: string, type: VoiceType) =>
    selectedVoiceName === name && selectedVoiceType === type;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-md max-h-[75vh] bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl rounded-2xl border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
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

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <button
            onClick={() => selectVoice('', 'device')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
              !selectedVoiceName && selectedVoiceType === 'device'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
            }`}
          >
            <span className="text-lg">🌐</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Automatica</div>
              <div className="text-xs text-white/40">Prima voce italiana del dispositivo</div>
            </div>
            {!selectedVoiceName && selectedVoiceType === 'device' && <span className="text-amber-400 text-xs">✓</span>}
          </button>

          {italianCloudVoices.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider px-1 pt-2">
                <Cloud size={12} className="text-sky-400" />
                Voci Cloud Italiane (Alta Qualità)
              </div>
              {italianCloudVoices.map(voice => (
                <VoiceRow
                  key={'cloud:' + voice.name}
                  label={voice.label}
                  sublabel={`${voice.gender} · ${voice.lang}`}
                  selected={isSelected(voice.name, 'cloud')}
                  playing={previewPlaying === 'cloud:' + voice.name}
                  onSelect={() => selectVoice(voice.name, 'cloud')}
                  onPreview={() => previewCloudVoice(voice)}
                  onStop={stopPreview}
                  badge={<Cloud size={10} className="text-sky-400" />}
                />
              ))}
            </>
          )}

          {otherCloudVoices.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider px-1 pt-2">
                <Cloud size={12} className="text-sky-400" />
                Altre Voci Cloud
              </div>
              {otherCloudVoices.map(voice => (
                <VoiceRow
                  key={'cloud:' + voice.name}
                  label={voice.label}
                  sublabel={`${voice.gender} · ${voice.lang}`}
                  selected={isSelected(voice.name, 'cloud')}
                  playing={previewPlaying === 'cloud:' + voice.name}
                  onSelect={() => selectVoice(voice.name, 'cloud')}
                  onPreview={() => previewCloudVoice(voice)}
                  onStop={stopPreview}
                  badge={<Cloud size={10} className="text-sky-400" />}
                />
              ))}
            </>
          )}

          {italianDeviceVoices.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider px-1 pt-2">
                <Monitor size={12} className="text-green-400" />
                Voci Dispositivo Italiane
              </div>
              {italianDeviceVoices.map(voice => (
                <VoiceRow
                  key={'device:' + voice.name}
                  label={voice.name}
                  sublabel={voice.lang}
                  selected={isSelected(voice.name, 'device')}
                  playing={previewPlaying === 'device:' + voice.name}
                  onSelect={() => selectVoice(voice.name, 'device')}
                  onPreview={() => previewDeviceVoice(voice)}
                  onStop={stopPreview}
                  badge={<Monitor size={10} className="text-green-400" />}
                />
              ))}
            </>
          )}

          {otherDeviceVoices.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-wider px-1 pt-2">
                <Monitor size={12} className="text-green-400" />
                Altre Voci Dispositivo
              </div>
              {otherDeviceVoices.map(voice => (
                <VoiceRow
                  key={'device:' + voice.name}
                  label={voice.name}
                  sublabel={voice.lang}
                  selected={isSelected(voice.name, 'device')}
                  playing={previewPlaying === 'device:' + voice.name}
                  onSelect={() => selectVoice(voice.name, 'device')}
                  onPreview={() => previewDeviceVoice(voice)}
                  onStop={stopPreview}
                  badge={<Monitor size={10} className="text-green-400" />}
                />
              ))}
            </>
          )}

          {deviceVoices.length === 0 && cloudVoices.length === 0 && (
            <div className="text-center text-white/40 text-sm py-6">
              Caricamento voci...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface VoiceRowProps {
  label: string;
  sublabel: string;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onStop: () => void;
  badge: React.ReactNode;
}

const VoiceRow: React.FC<VoiceRowProps> = ({ label, sublabel, selected, playing, onSelect, onPreview, onStop, badge }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
    selected ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'
  }`}>
    <button onClick={onSelect} className="flex-1 text-left min-w-0 flex items-center gap-2">
      <span className="flex-shrink-0">{badge}</span>
      <div className="min-w-0">
        <div className={`text-sm font-medium truncate ${selected ? 'text-amber-300' : 'text-white/70'}`}>
          {label}
        </div>
        <div className="text-[10px] text-white/35">{sublabel}</div>
      </div>
    </button>
    <button
      onClick={playing ? onStop : onPreview}
      className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
        playing
          ? 'bg-red-500/30 text-red-300 hover:bg-red-500/40'
          : 'bg-white/10 hover:bg-amber-500/30 text-white/60 hover:text-amber-300'
      }`}
      title={playing ? "Stop" : "Anteprima"}
    >
      {playing ? <Square size={12} /> : <Play size={12} />}
    </button>
    {selected && <span className="text-amber-400 text-xs flex-shrink-0">✓</span>}
  </div>
);
