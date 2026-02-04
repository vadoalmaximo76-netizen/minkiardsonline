import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Bell, Send, RefreshCw } from 'lucide-react';
import { AddCardsModal } from './AddCardsModal';

interface CardAdminPanelProps {
  onBack: () => void;
}

export function CardAdminPanel({ onBack }: CardAdminPanelProps) {
  const [showAddCardsModal, setShowAddCardsModal] = useState(false);
  const [cardVersion, setCardVersion] = useState<number>(1);
  const [updateNote, setUpdateNote] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadVersion();
  }, []);

  const loadVersion = async () => {
    try {
      const res = await fetch('/api/card-version');
      if (res.ok) {
        const data = await res.json();
        setCardVersion(data.version || 1);
      }
    } catch (error) {
      console.error('Error loading version:', error);
    }
  };

  const publishUpdate = async () => {
    if (!updateNote.trim()) {
      setMessage({ type: 'error', text: 'Inserisci una nota per l\'aggiornamento' });
      return;
    }
    
    setPublishing(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/publish-card-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ note: updateNote })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCardVersion(data.newVersion);
        setUpdateNote('');
        setMessage({ type: 'success', text: `Aggiornamento v${data.newVersion} pubblicato! Notifiche inviate a tutti gli utenti.` });
      } else {
        setMessage({ type: 'error', text: 'Errore nella pubblicazione' });
      }
    } catch (error) {
      console.error('Error publishing update:', error);
      setMessage({ type: 'error', text: 'Errore di rete' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-purple-400" />
              <h1 className="text-xl font-bold text-white">Gestione Carte Admin</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-purple-300">
              Versione carte: <span className="font-bold text-white">v{cardVersion}</span>
            </div>
            <button
              onClick={() => setShowAddCardsModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Apri Editor Carte
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 px-4 pb-8 max-w-4xl mx-auto">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* Info Card */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-purple-500/20 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Settings className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Pannello Amministratore</h2>
              <p className="text-purple-200/70 text-sm mb-4">
                Da qui puoi modificare tutte le carte del gioco. Usa l'editor carte per aggiungere, modificare 
                o eliminare carte, aggiungere effetti con il wizard, impostare statistiche e molto altro.
              </p>
              <p className="text-purple-200/70 text-sm">
                Quando hai finito le modifiche, pubblica un aggiornamento per notificare tutti i giocatori.
              </p>
            </div>
          </div>
        </div>

        {/* Publish Update Section */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-amber-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-amber-400" />
            <h3 className="text-lg font-bold text-white">Pubblica Aggiornamento</h3>
          </div>
          
          <p className="text-amber-200/70 text-sm mb-4">
            Dopo aver modificato le carte, pubblica un aggiornamento per notificare tutti i giocatori 
            che è disponibile una nuova versione delle carte.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-purple-300 mb-2">
                Nota di aggiornamento (cosa è cambiato):
              </label>
              <textarea
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                placeholder="Es: Nuove carte aggiunte, bilanciamenti, correzioni..."
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 text-sm resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={publishUpdate}
                disabled={publishing || !updateNote.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all flex items-center justify-center gap-2"
              >
                {publishing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Pubblicazione...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Pubblica v{cardVersion + 1}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowAddCardsModal(true)}
            className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all text-left"
          >
            <div className="text-purple-400 font-bold mb-1">Modifica Carte Esistenti</div>
            <div className="text-purple-200/60 text-sm">Modifica statistiche, effetti e proprietà delle carte</div>
          </button>
          <button
            onClick={() => setShowAddCardsModal(true)}
            className="p-4 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all text-left"
          >
            <div className="text-purple-400 font-bold mb-1">Aggiungi Nuove Carte</div>
            <div className="text-purple-200/60 text-sm">Carica nuove carte con immagini e effetti</div>
          </button>
        </div>
      </div>

      {/* AddCardsModal - The actual card editor */}
      <AddCardsModal 
        isOpen={showAddCardsModal} 
        onClose={() => setShowAddCardsModal(false)} 
      />
    </div>
  );
}
