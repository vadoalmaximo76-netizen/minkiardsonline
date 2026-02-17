import React, { useEffect, useState, useRef, useCallback } from "react";
import useNarrator from "../lib/stores/useNarrator";

function speakText(text: string, preferredVoiceName: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    const voices = window.speechSynthesis.getVoices();
    if (preferredVoiceName) {
      const preferred = voices.find(v => v.name === preferredVoiceName);
      if (preferred) utterance.voice = preferred;
    } else {
      const italianVoice = voices.find(v => v.lang.startsWith('it'));
      if (italianVoice) utterance.voice = italianVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

interface NarratorBannerProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export const NarratorBanner: React.FC<NarratorBannerProps> = ({
  message,
  visible,
  onDismiss,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charIndexRef = useRef(0);
  const lastSpokenRef = useRef("");
  const selectedVoiceName = useNarrator(s => s.selectedVoiceName);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible && message) {
      cleanup();
      setDisplayedText("");
      charIndexRef.current = 0;
      setShouldRender(true);
      setIsAnimatingOut(false);

      if (message !== lastSpokenRef.current) {
        lastSpokenRef.current = message;
        speakText(message, selectedVoiceName);
      }

      requestAnimationFrame(() => {
        setIsAnimatingIn(true);
      });

      intervalRef.current = setInterval(() => {
        charIndexRef.current += 1;
        const currentIndex = charIndexRef.current;

        if (currentIndex >= message.length) {
          setDisplayedText(message);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          dismissTimerRef.current = setTimeout(() => {
            onDismiss();
          }, 5000);
        } else {
          setDisplayedText(message.slice(0, currentIndex));
        }
      }, 30);
    }

    if (!visible && shouldRender) {
      cleanup();
      setIsAnimatingIn(false);
      setIsAnimatingOut(true);
      try { window.speechSynthesis.cancel(); } catch (e) {}

      dismissTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
        setDisplayedText("");
        charIndexRef.current = 0;
      }, 400);
    }

    return cleanup;
  }, [visible, message, selectedVoiceName]);

  const handleDismiss = useCallback(() => {
    cleanup();
    onDismiss();
  }, [cleanup, onDismiss]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[9000] pointer-events-auto transition-all duration-400 ease-out ${
        isAnimatingIn && !isAnimatingOut
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      }`}
      style={{ bottom: "120px", maxWidth: "600px", width: "calc(100% - 32px)" }}
      onClick={handleDismiss}
    >
      <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-yellow-500/50 px-5 py-4 shadow-2xl shadow-black/40 cursor-pointer">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0 mt-0.5">🪶</span>
          <div className="flex-1 min-w-0">
            <p className="text-yellow-400/90 text-xs font-semibold tracking-wide mb-1">
              🎙️ Narratore 🔊
            </p>
            <p className="text-white text-sm leading-relaxed">
              {displayedText}
              {displayedText.length < message.length && (
                <span className="inline-block w-0.5 h-4 bg-yellow-400/80 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
