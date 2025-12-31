import React, { useState } from "react";
import { Button } from "./ui/button";
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
      <DialogContent className="sm:max-w-md bg-gray-800 border-gray-600">
        <DialogHeader>
          <DialogTitle className="text-white text-center text-2xl">
            Welcome to MINKIARDS
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white block mb-2">Inserisci il tuo nome:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-sky-blue"
              placeholder="Il tuo nome"
              autoFocus
              maxLength={20}
            />
          </div>
          
          <div>
            <label className="text-white block mb-2">Scegli il tuo avatar:</label>
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-700 rounded">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={`
                    w-10 h-10 flex items-center justify-center rounded-lg text-xl
                    transition-all duration-200 hover:scale-110
                    ${selectedAvatar === avatar.id 
                      ? 'bg-purple-600 ring-2 ring-white shadow-lg' 
                      : 'bg-gray-600 hover:bg-gray-500'
                    }
                  `}
                  title={avatar.name}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
          </div>
          
          <Button
            type="submit"
            className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
            disabled={!name.trim()}
          >
            ENTRA NEL GIOCO
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
