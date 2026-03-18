import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { AVATARS } from "../lib/avatars";

interface PlayerNameDialogProps {
  open: boolean;
  onSubmit: (name: string, avatarId: string) => void;
}

export const PlayerNameDialog: React.FC<PlayerNameDialogProps> = ({ open, onSubmit }) => {
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), selectedAvatar);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-xl border border-violet-500/30 shadow-[0_0_40px_rgba(124,58,237,0.3)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Benvenuto in MINKIARDS
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Inserisci il tuo nome:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/40 border border-violet-500/20 text-violet-100 placeholder:text-violet-300/40 rounded-xl focus:outline-none focus:border-violet-400/60 transition-colors"
              placeholder="Il tuo nome"
              autoFocus
              maxLength={20}
            />
          </div>

          <div>
            <label className="text-violet-300/80 block mb-2 text-sm font-semibold">Scegli il tuo avatar:</label>
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-black/30 rounded-xl border border-violet-500/10">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={`
                    w-10 h-10 flex items-center justify-center rounded-lg text-xl
                    transition-all duration-200 hover:scale-110
                    ${selectedAvatar === avatar.id
                      ? 'bg-violet-600/70 ring-2 ring-violet-400 shadow-[0_0_10px_rgba(124,58,237,0.5)]'
                      : 'bg-white/5 hover:bg-violet-900/40'
                    }
                  `}
                  title={avatar.name}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
            disabled={!name.trim()}
          >
            ENTRA NEL GIOCO
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
