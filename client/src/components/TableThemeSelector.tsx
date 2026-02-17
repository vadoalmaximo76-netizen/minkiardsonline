import React, { useEffect, useRef } from "react";
import { X, Settings, Check } from "lucide-react";
import useTableTheme, { TABLE_THEMES } from "../lib/stores/useTableTheme";

interface TableThemeSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export const TableThemeSelector: React.FC<TableThemeSelectorProps> = ({
  visible,
  onClose,
}) => {
  const { currentThemeId, setTheme } = useTableTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${
          visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full max-w-sm w-full z-[61] transition-transform duration-300 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full bg-black/60 backdrop-blur-xl border-l border-white/10 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Settings className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Tema Tavolo</h2>
                <p className="text-xs text-white/50">Personalizza il tuo tavolo da gioco</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {TABLE_THEMES.map((theme) => {
              const isSelected = currentThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  className={`w-full rounded-xl overflow-hidden transition-all duration-200 relative ${
                    isSelected
                      ? "ring-2 ring-amber-400 shadow-lg shadow-amber-500/20"
                      : "ring-1 ring-white/10 hover:ring-white/30"
                  }`}
                  style={{ height: "100px" }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: theme.tableSurface }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

                  <div className="relative h-full flex items-center px-4 gap-3">
                    <span className="text-2xl flex-shrink-0">{theme.emoji}</span>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {theme.name}
                      </p>
                      <p className="text-white/60 text-xs truncate">
                        {theme.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center">
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </div>

                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{
                      backgroundColor: isSelected ? theme.tableBorder : "transparent",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-white/10">
            <p className="text-xs text-white/40 text-center">
              Il tema selezionato verrà applicato al tavolo di gioco
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
