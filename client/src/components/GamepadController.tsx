import React, { useEffect } from "react";
import { useGamepad } from "../lib/useGamepad";
import { useGamepadStore } from "../lib/stores/useGamepadStore";
import { useGameState } from "../lib/stores/useGameState";
import { toast } from "sonner";

const ZONE_LABELS: Record<string, string> = {
  'hand': 'Mano',
  'field-own': 'Campo',
  'field-enemy': 'Nemici',
};

export const GamepadController: React.FC = () => {
  useGamepad();

  const connected = useGamepadStore(s => s.connected);
  const focusZone = useGamepadStore(s => s.focusZone);
  const modalFocusIndex = useGamepadStore(s => s.modalFocusIndex);

  useEffect(() => {
    const handleConnect = (e: CustomEvent<{ id: string }>) => {
      toast.success("🎮 Controller connesso!", {
        description: e.detail?.id ? e.detail.id.slice(0, 40) : "Gamepad rilevato",
        duration: 3000,
      });
    };
    const handleDisconnect = () => {
      toast.error("🎮 Controller disconnesso", { duration: 3000 });
    };

    window.addEventListener("gamepad-connected", handleConnect as EventListener);
    window.addEventListener("gamepad-disconnected", handleDisconnect as EventListener);
    return () => {
      window.removeEventListener("gamepad-connected", handleConnect as EventListener);
      window.removeEventListener("gamepad-disconnected", handleDisconnect as EventListener);
    };
  }, []);

  const handModalOpen = useGameState(s => s.handModalOpen);

  useEffect(() => {
    let prevModals = new Set<string>();
    const observer = new MutationObserver(() => {
      const current = new Set(
        Array.from(document.querySelectorAll('[data-modal]')).map(
          el => (el as HTMLElement).dataset.modal ?? ''
        )
      );
      for (const key of current) {
        if (!prevModals.has(key)) {
          useGamepadStore.getState().setModalFocusIndex(0);
          break;
        }
      }
      prevModals = current;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!connected) return;
    const options = document.querySelectorAll<HTMLElement>('[data-modal-option]');
    options.forEach((el, i) => {
      if (i === modalFocusIndex) {
        el.classList.add('gamepad-modal-focus');
      } else {
        el.classList.remove('gamepad-modal-focus');
      }
    });
  }, [modalFocusIndex, connected, handModalOpen]);

  if (!connected) return null;

  return (
    <div
      title="Gamepad connesso — D-pad/stick sinistro: naviga | A: conferma | B: annulla/ESC | Start: fine turno | LB/RB: cambia zona"
      className="fixed top-2 right-2 z-[200] flex items-center gap-1.5 bg-black/80 border border-violet-500/60 text-violet-300 text-[10px] font-bold px-2 py-1 rounded-full shadow-lg select-none pointer-events-none"
      style={{ backdropFilter: "blur(8px)" }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
        <path d="M17 6H7C3.69 6 1 8.69 1 12s2.69 6 6 6h10c3.31 0 6-2.69 6-6s-2.69-6-6-6zm-10 7H6v1H5v-1H4v-1h1v-1h1v1h1v1zm4.5 2c-.83 0-1.5-.67-1.5-1.5S10.67 12 11.5 12s1.5.67 1.5 1.5S12.33 15 11.5 15zm3-3c-.83 0-1.5-.67-1.5-1.5S13.67 9 14.5 9s1.5.67 1.5 1.5S15.33 12 14.5 12zm3 3c-.83 0-1.5-.67-1.5-1.5S16.67 12 17.5 12s1.5.67 1.5 1.5S18.33 15 17.5 15z"/>
      </svg>
      <span className="text-green-400">●</span>
      <span>{ZONE_LABELS[focusZone] ?? focusZone}</span>
    </div>
  );
};

export default GamepadController;
