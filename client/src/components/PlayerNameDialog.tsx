import React, { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

interface PlayerNameDialogProps {
  open: boolean;
  onSubmit: (name: string) => void;
}

export const PlayerNameDialog: React.FC<PlayerNameDialogProps> = ({ open, onSubmit }) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
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
            <label className="text-white block mb-2">Enter your name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border-0 focus:outline-none focus:ring-2 focus:ring-sky-blue"
              placeholder="Your name"
              autoFocus
              maxLength={20}
            />
          </div>
          
          <Button
            type="submit"
            className="w-full bg-sky-blue hover:bg-sky-blue/80 text-white font-bold py-3"
            disabled={!name.trim()}
          >
            JOIN GAME
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
