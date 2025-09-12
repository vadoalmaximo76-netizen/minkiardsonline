import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useGameState } from "../lib/stores/useGameState";
import { socket } from "../lib/socket";
import { Bot, Users, MessageCircle, Clock, Terminal, Send, HelpCircle } from "lucide-react";

export const CPUControls: React.FC = () => {
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
    
    // Send instruction to backend
    socket.emit('cpu-instruction', { 
      gameId, 
      instruction: instructionText.trim() 
    });
    
    setLastInstructionResult(`Istruzione inviata: "${instructionText}"`);
    setInstructionText("");
    
    // Clear result after 3 seconds
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
      // Check if message is from a CPU asking a question
      if (message.playerName.startsWith('CPU-') && message.message.includes('?')) {
        setCpuWaitingForResponse(message.playerName);
      }
      // Check if message is CPU confirming they received answer
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
    <div className="bg-gray-800/90 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <Bot size={20} />
          Giocatori CPU
        </h3>
        <Button
          onClick={handleAddCPU}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2"
          disabled={cpuPlayers.length >= 3} // Max 3 CPU players
        >
          <Bot size={16} className="mr-2" />
          Aggiungi CPU
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-green-400 font-semibold mb-2 flex items-center gap-2">
            <Users size={16} />
            Giocatori Umani ({humanPlayers.length})
          </h4>
          <div className="space-y-1">
            {humanPlayers.map((player: any) => (
              <div key={player.name} className="text-white text-sm bg-green-600/20 rounded px-2 py-1">
                {player.name}
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
            <Bot size={16} />
            Giocatori CPU ({cpuPlayers.length})
          </h4>
          <div className="space-y-1">
            {cpuPlayers.map((player: any) => (
              <div key={player.name} className="text-white text-sm bg-purple-600/20 rounded px-2 py-1">
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
        <div className="mt-3 bg-orange-600/20 border border-orange-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-orange-300 font-semibold mb-2">
            <MessageCircle size={16} className="animate-pulse" />
            <Clock size={16} className="animate-spin" />
            CPU Aspetta Risposta
          </div>
          <p className="text-white text-sm">
            <strong>{cpuWaitingForResponse}</strong> ha fatto una domanda nella chat e aspetta la tua risposta prima di procedere.
          </p>
          <p className="text-orange-200 text-xs mt-1">
            💬 Rispondi nella chat per permettere al CPU di continuare
          </p>
        </div>
      )}

      {/* CPU Instruction Panel */}
      <div className="mt-4 bg-blue-600/20 border border-blue-500 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-blue-300 font-semibold flex items-center gap-2">
            <Terminal size={16} />
            Pannello Istruzioni CPU
          </h4>
          <Button
            onClick={() => setShowExamples(!showExamples)}
            className="bg-blue-600/40 hover:bg-blue-600/60 text-blue-200 text-xs px-2 py-1"
          >
            <HelpCircle size={12} className="mr-1" />
            {showExamples ? 'Nascondi' : 'Esempi'}
          </Button>
        </div>
        
        {showExamples && (
          <div className="mb-3 bg-blue-900/30 rounded p-2">
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
            placeholder="Scrivi un comando per il CPU (es: CPU-Alessio pesca PERSONAGGI)"
            className="flex-1 bg-blue-900/30 border border-blue-400/30 rounded px-3 py-2 text-white text-sm placeholder-blue-300/60 focus:outline-none focus:border-blue-400"
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
          <div className="mt-2 bg-green-600/20 border border-green-500/30 rounded px-3 py-2">
            <p className="text-green-200 text-xs">{lastInstructionResult}</p>
          </div>
        )}
        
        <p className="text-blue-200/60 text-xs mt-2">
          💡 Usa comandi naturali in italiano per dare istruzioni specifiche ai CPU
        </p>
      </div>
      
      <div className="mt-3 text-xs text-gray-400">
        <p>💡 I giocatori CPU analizzeranno le carte usando l'AI e giocheranno automaticamente</p>
        <p>🎯 Seguiranno le regole ufficiali di MINKIARDS e leggeranno il testo delle carte</p>
        <p>💬 I CPU possono fare domande nella chat per chiarire dubbi o strategie</p>
      </div>
    </div>
  );
};