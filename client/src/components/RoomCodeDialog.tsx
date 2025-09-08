import React, { useState } from "react";
import { Button } from "./ui/button";

interface RoomCodeDialogProps {
  open: boolean;
  onSubmit: (roomCode: string) => void;
}

export const RoomCodeDialog: React.FC<RoomCodeDialogProps> = ({ open, onSubmit }) => {
  const [roomCode, setRoomCode] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingRoom) {
      // Generate a random room code
      const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      onSubmit(newRoomCode);
    } else if (roomCode.trim()) {
      onSubmit(roomCode.trim().toUpperCase());
    }
  };

  const handleCreateRoom = () => {
    setIsCreatingRoom(true);
    handleSubmit(new Event('submit') as any);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">MINKIARDS</h2>
          <p className="text-gray-300">Seleziona o crea una stanza di gioco</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="roomCode" className="block text-white font-bold mb-2">
              Codice Stanza
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Inserisci il codice della stanza"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-blue"
              maxLength={10}
              disabled={isCreatingRoom}
            />
          </div>

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={!roomCode.trim() || isCreatingRoom}
              className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
            >
              Entra nella Stanza
            </Button>

            <div className="text-center text-gray-400">oppure</div>

            <Button
              type="button"
              onClick={handleCreateRoom}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
            >
              Crea Nuova Stanza
            </Button>
          </div>
        </form>

        <div className="mt-6 text-xs text-gray-400 text-center">
          Condividi il codice della stanza con i tuoi amici per giocare insieme
        </div>
      </div>
    </div>
  );
};