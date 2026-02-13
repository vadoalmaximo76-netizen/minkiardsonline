import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { Bot, Users, MessageCircle, Clock, Terminal, Send, HelpCircle, X } from "lucide-react";

interface CPUControlsProps {
  onClose: () => void;
}

export const CPUControls: React.FC<CPUControlsProps> = ({ onClose }) => {
  const { gameId, gameState } = useGameState();
  const [cpuWaitingForResponse, setCpuWaitingForResponse] = useState<string | null>(null);
  const [instructionText, setInstructionText] = useState<string>("");
  const [showExamples, setShowExamples] = useState<boolean>(false);
  const [lastInstructionResult, setLastInstructionResult] = useState<string | null>(null);

  const handleAddCPU = () => {
    if (gameId) {
      socket.emit('add-cpu-player', { gameId });
    }
  };

  const handleSendInstruction = () => {
    if (!instructionText.trim() || !gameId) return;
    
    socket.emit('cpu-instruction', { 
      gameId, 
      instruction: instructionText.trim() 
    });
    
    setLastInstructionResult(`Istruzione inviata: "${instructionText}"`);
    setInstructionText("");
    
    setTimeout(() => setLastInstructionResult(null), 3000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInstruction();
    }
  };

  const exampleInstructions = [
    "CPU-Alessio pesca PERSONAGGI SPECIALI",
    "CPU-Marco gioca la carta dal campo",
    "CPU-Luigi attacca il personaggio nemico",
    "CPU-Sofia pesca MOSSE",
    "CPU-Giulia aspetta il prossimo turno",
    "CPU-Roberto pesca BONUS"
  ];

  useEffect(() => {
    const handleCPUWaiting = ({ cpuName }: { cpuName: string }) => {
      setCpuWaitingForResponse(cpuName);
    };

    const handleCPUResumed = ({ cpuName }: { cpuName: string }) => {
      setCpuWaitingForResponse(null);
    };

    const handleChatMessage = (message: any) => {
      if (message.playerName.startsWith('CPU-') && message.message.includes('?')) {
        setCpuWaitingForResponse(message.playerName);
      }
      if (message.playerName.startsWith('CPU-') && message.message.includes('Grazie per la spiegazione')) {
        setCpuWaitingForResponse(null);
      }
    };

    const handleInstructionSuccess = ({ message }: { message: string }) => {
      setLastInstructionResult(message);
      setTimeout(() => setLastInstructionResult(null), 4000);
    };

    const handleInstructionError = ({ message }: { message: string }) => {
      setLastInstructionResult(`❌ ${message}`);
      setTimeout(() => setLastInstructionResult(null), 6000);
    };

    socket.on('cpu-waiting-for-response', handleCPUWaiting);
    socket.on('cpu-response-received', handleCPUResumed);
    socket.on('chat-message', handleChatMessage);
    socket.on('instruction-success', handleInstructionSuccess);
    socket.on('instruction-error', handleInstructionError);

    return () => {
      socket.off('cpu-waiting-for-response', handleCPUWaiting);
      socket.off('cpu-response-received', handleCPUResumed);
      socket.off('chat-message', handleChatMessage);
      socket.off('instruction-success', handleInstructionSuccess);
      socket.off('instruction-error', handleInstructionError);
    };
  }, []);

  const cpuPlayers = gameState?.players ? 
    Object.values(gameState.players).filter((player: any) => player.name.startsWith('CPU-')) : [];

  const humanPlayers = gameState?.players ? 
    Object.values(gameState.players).filter((player: any) => !player.name.startsWith('CPU-')) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/20 p-5 w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Bot size={20} className="text-purple-400" />
            Giocatori CPU
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleAddCPU}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 text-sm"
              disabled={cpuPlayers.length >= 3}
            >
              <Bot size={14} className="mr-1.5" />
              Aggiungi CPU
            </Button>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-all duration-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-green-600/10 border border-green-500/20 rounded-xl p-3">
            <h4 className="text-green-400 font-semibold mb-2 flex items-center gap-2 text-sm">
              <Users size={14} />
              Umani ({humanPlayers.length})
            </h4>
            <div className="space-y-1">
              {humanPlayers.map((player: any) => (
                <div key={player.name} className="text-white text-sm bg-green-600/20 rounded-lg px-2.5 py-1.5">
                  {player.name}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-3">
            <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2 text-sm">
              <Bot size={14} />
              CPU ({cpuPlayers.length})
            </h4>
            <div className="space-y-1">
              {cpuPlayers.map((player: any) => (
                <div key={player.name} className="text-white text-sm bg-purple-600/20 rounded-lg px-2.5 py-1.5">
                  {player.name}
                </div>
              ))}
              {cpuPlayers.length === 0 && (
                <p className="text-gray-400 text-xs italic">Nessun CPU aggiunto</p>
              )}
            </div>
          </div>
        </div>
        
        {cpuWaitingForResponse && (
          <div className="mb-4 bg-orange-600/15 border border-orange-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-orange-300 font-semibold mb-2 text-sm">
              <MessageCircle size={14} className="animate-pulse" />
              <Clock size={14} className="animate-spin" />
              CPU Aspetta Risposta
            </div>
            <p className="text-white text-sm">
              <strong>{cpuWaitingForResponse}</strong> ha fatto una domanda nella chat e aspetta la tua risposta prima di procedere.
            </p>
            <p className="text-orange-200 text-xs mt-1">
              Rispondi nella chat per permettere al CPU di continuare
            </p>
          </div>
        )}

        <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-blue-300 font-semibold flex items-center gap-2 text-sm">
              <Terminal size={14} />
              Istruzioni CPU
            </h4>
            <Button
              onClick={() => setShowExamples(!showExamples)}
              className="bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs px-2 py-1"
            >
              <HelpCircle size={12} className="mr-1" />
              {showExamples ? 'Nascondi' : 'Esempi'}
            </Button>
          </div>
          
          {showExamples && (
            <div className="mb-3 bg-blue-900/30 rounded-lg p-2">
              <p className="text-blue-200 text-xs font-semibold mb-2">Esempi di comandi:</p>
              <div className="grid grid-cols-1 gap-1">
                {exampleInstructions.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setInstructionText(example)}
                    className="text-left text-blue-100 text-xs hover:bg-blue-600/30 rounded px-2 py-1 transition-colors"
                  >
                    "{example}"
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              type="text"
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scrivi un comando per il CPU..."
              className="flex-1 bg-blue-900/30 border border-blue-400/30 rounded-lg px-3 py-2 text-white text-sm placeholder-blue-300/50 focus:outline-none focus:border-blue-400"
            />
            <Button
              onClick={handleSendInstruction}
              disabled={!instructionText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2"
            >
              <Send size={14} />
            </Button>
          </div>
          
          {lastInstructionResult && (
            <div className="mt-2 bg-green-600/15 border border-green-500/30 rounded-lg px-3 py-2">
              <p className="text-green-200 text-xs">{lastInstructionResult}</p>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-400 space-y-1">
          <p>I giocatori CPU analizzeranno le carte usando l'AI e giocheranno automaticamente</p>
          <p>Seguiranno le regole ufficiali di MINKIARDS e leggeranno il testo delle carte</p>
          <p>I CPU possono fare domande nella chat per chiarire dubbi o strategie</p>
        </div>
      </div>
    </div>
  );
};
