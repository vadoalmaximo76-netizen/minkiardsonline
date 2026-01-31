import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, Trophy, Gift, Star, Crown } from 'lucide-react';

interface SeasonalPass {
  id: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  maxLevel: number;
  isActive: boolean;
  createdAt: string;
}

interface PassReward {
  id: number;
  passId: number;
  level: number;
  rewardType: string;
  rewardValue: string;
  isPremium: boolean;
}

interface AdminPassPanelProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string | null;
}

const REWARD_TYPES = [
  { value: 'rankiard', label: 'Punti Rankiard' },
  { value: 'skin', label: 'Skin Carta' },
  { value: 'card', label: 'Carta Esclusiva' },
  { value: 'title', label: 'Titolo' },
  { value: 'avatar', label: 'Avatar' },
  { value: 'xp_boost', label: 'Boost XP' }
];

export function AdminPassPanel({ isOpen, onClose, authToken }: AdminPassPanelProps) {
  const [passes, setPasses] = useState<SeasonalPass[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassForm, setShowPassForm] = useState(false);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingPass, setEditingPass] = useState<SeasonalPass | null>(null);
  const [selectedPass, setSelectedPass] = useState<SeasonalPass | null>(null);
  const [passRewards, setPassRewards] = useState<PassReward[]>([]);
  const [passFormData, setPassFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    maxLevel: 50,
    isActive: true
  });
  const [rewardFormData, setRewardFormData] = useState({
    level: 1,
    rewardType: 'rankiard',
    rewardValue: '',
    isPremium: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && authToken) {
      fetchPasses();
    }
  }, [isOpen, authToken]);

  const fetchPasses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seasonal-passes', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setPasses(data.passes);
      }
    } catch (error) {
      console.error('Failed to fetch passes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPassRewards = async (passId: number) => {
    try {
      const res = await fetch(`/api/seasonal-pass/${passId}/rewards`);
      const data = await res.json();
      if (data.success) {
        setPassRewards(data.rewards);
      }
    } catch (error) {
      console.error('Failed to fetch pass rewards:', error);
    }
  };

  const handleSavePass = async () => {
    if (!passFormData.name || !passFormData.startDate || !passFormData.endDate) {
      setError('Nome, data inizio e data fine sono obbligatori');
      return;
    }

    try {
      const url = editingPass 
        ? `/api/admin/seasonal-passes/${editingPass.id}`
        : '/api/admin/seasonal-passes';
      
      const res = await fetch(url, {
        method: editingPass ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(passFormData)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(editingPass ? 'Pass aggiornato!' : 'Pass creato!');
        setShowPassForm(false);
        setEditingPass(null);
        resetPassForm();
        fetchPasses();
      } else {
        setError(data.error || 'Errore nel salvare il pass');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleDeletePass = async (passId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questo pass e tutte le sue ricompense?')) return;

    try {
      const res = await fetch(`/api/admin/seasonal-passes/${passId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Pass eliminato!');
        fetchPasses();
        if (selectedPass?.id === passId) {
          setSelectedPass(null);
          setPassRewards([]);
        }
      } else {
        setError(data.error || 'Errore nell\'eliminare il pass');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleSaveReward = async () => {
    if (!selectedPass || !rewardFormData.rewardValue) {
      setError('Valore ricompensa obbligatorio');
      return;
    }

    try {
      const res = await fetch(`/api/admin/seasonal-passes/${selectedPass.id}/rewards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(rewardFormData)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Ricompensa aggiunta!');
        setShowRewardForm(false);
        resetRewardForm();
        fetchPassRewards(selectedPass.id);
      } else {
        setError(data.error || 'Errore nell\'aggiungere la ricompensa');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleDeleteReward = async (rewardId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa ricompensa?')) return;

    try {
      const res = await fetch(`/api/admin/pass-rewards/${rewardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Ricompensa eliminata!');
        if (selectedPass) {
          fetchPassRewards(selectedPass.id);
        }
      } else {
        setError(data.error || 'Errore nell\'eliminare la ricompensa');
      }
    } catch (error) {
      setError('Errore di connessione');
    }

    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const resetPassForm = () => {
    setPassFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      maxLevel: 50,
      isActive: true
    });
  };

  const resetRewardForm = () => {
    setRewardFormData({
      level: 1,
      rewardType: 'rankiard',
      rewardValue: '',
      isPremium: false
    });
  };

  const openEditPass = (pass: SeasonalPass) => {
    setEditingPass(pass);
    setPassFormData({
      name: pass.name,
      description: pass.description || '',
      startDate: pass.startDate.split('T')[0],
      endDate: pass.endDate.split('T')[0],
      maxLevel: pass.maxLevel,
      isActive: pass.isActive
    });
    setShowPassForm(true);
  };

  const openPassRewards = (pass: SeasonalPass) => {
    setSelectedPass(pass);
    fetchPassRewards(pass.id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getRewardTypeLabel = (type: string) => {
    return REWARD_TYPES.find(t => t.value === type)?.label || type;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-amber-900 to-amber-950 rounded-xl border border-amber-500/30 w-full max-w-5xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-amber-500/30">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" />
            Gestione Pass Stagionali
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-4 mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm">
            {success}
          </div>
        )}

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!selectedPass ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-amber-300">Pass Stagionali</h3>
                <button
                  onClick={() => { setShowPassForm(true); setEditingPass(null); resetPassForm(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuovo Pass
                </button>
              </div>

              {showPassForm && (
                <div className="mb-6 p-4 bg-amber-800/30 rounded-lg border border-amber-500/30">
                  <h4 className="text-md font-semibold text-white mb-4">
                    {editingPass ? 'Modifica Pass' : 'Crea Nuovo Pass'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Nome *</label>
                      <input
                        type="text"
                        value={passFormData.name}
                        onChange={(e) => setPassFormData({ ...passFormData, name: e.target.value })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                        placeholder="Es: Pass Stagione 1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Livello Massimo</label>
                      <input
                        type="number"
                        value={passFormData.maxLevel}
                        onChange={(e) => setPassFormData({ ...passFormData, maxLevel: parseInt(e.target.value) || 50 })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                        min="1"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Data Inizio *</label>
                      <input
                        type="date"
                        value={passFormData.startDate}
                        onChange={(e) => setPassFormData({ ...passFormData, startDate: e.target.value })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Data Fine *</label>
                      <input
                        type="date"
                        value={passFormData.endDate}
                        onChange={(e) => setPassFormData({ ...passFormData, endDate: e.target.value })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-amber-300 mb-1">Descrizione</label>
                      <textarea
                        value={passFormData.description}
                        onChange={(e) => setPassFormData({ ...passFormData, description: e.target.value })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white h-20"
                        placeholder="Descrizione del pass..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="passIsActive"
                        checked={passFormData.isActive}
                        onChange={(e) => setPassFormData({ ...passFormData, isActive: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="passIsActive" className="text-sm text-amber-300">Pass Attivo</label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSavePass}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Salva
                    </button>
                    <button
                      onClick={() => { setShowPassForm(false); setEditingPass(null); resetPassForm(); }}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center text-amber-300 py-8">Caricamento...</div>
              ) : passes.length === 0 ? (
                <div className="text-center text-amber-400 py-8">Nessun pass creato</div>
              ) : (
                <div className="grid gap-4">
                  {passes.map((pass) => (
                    <div
                      key={pass.id}
                      className="p-4 bg-amber-800/30 rounded-lg border border-amber-500/30 hover:border-amber-400/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-white">{pass.name}</h4>
                            {pass.isActive ? (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Attivo</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">Inattivo</span>
                            )}
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                              Max Lv. {pass.maxLevel}
                            </span>
                          </div>
                          {pass.description && (
                            <p className="text-sm text-amber-300 mt-1">{pass.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-amber-400">
                            <span>
                              {formatDate(pass.startDate)} - {formatDate(pass.endDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openPassRewards(pass)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-white text-sm"
                          >
                            Ricompense
                          </button>
                          <button
                            onClick={() => openEditPass(pass)}
                            className="p-2 text-amber-400 hover:text-white hover:bg-amber-700/50 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePass(pass.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <button
                    onClick={() => { setSelectedPass(null); setPassRewards([]); }}
                    className="text-amber-400 hover:text-white text-sm mb-1"
                  >
                    ← Torna ai pass
                  </button>
                  <h3 className="text-lg font-semibold text-white">
                    Ricompense: {selectedPass.name}
                  </h3>
                  <p className="text-sm text-amber-400">Livelli: 1 - {selectedPass.maxLevel}</p>
                </div>
                <button
                  onClick={() => { setShowRewardForm(true); resetRewardForm(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-white text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi Ricompensa
                </button>
              </div>

              {showRewardForm && (
                <div className="mb-6 p-4 bg-amber-800/30 rounded-lg border border-amber-500/30">
                  <h4 className="text-md font-semibold text-white mb-4">Aggiungi Ricompensa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Livello *</label>
                      <input
                        type="number"
                        value={rewardFormData.level}
                        onChange={(e) => setRewardFormData({ ...rewardFormData, level: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                        min="1"
                        max={selectedPass.maxLevel}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Tipo Ricompensa *</label>
                      <select
                        value={rewardFormData.rewardType}
                        onChange={(e) => setRewardFormData({ ...rewardFormData, rewardType: e.target.value })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                      >
                        {REWARD_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-amber-300 mb-1">Valore *</label>
                      <input
                        type="text"
                        value={rewardFormData.rewardValue}
                        onChange={(e) => setRewardFormData({ ...rewardFormData, rewardValue: e.target.value })}
                        className="w-full px-3 py-2 bg-amber-900/50 border border-amber-500/30 rounded-lg text-white"
                        placeholder={rewardFormData.rewardType === 'rankiard' ? 'Es: 100' : 'Nome/ID ricompensa'}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="isPremium"
                        checked={rewardFormData.isPremium}
                        onChange={(e) => setRewardFormData({ ...rewardFormData, isPremium: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="isPremium" className="text-sm text-amber-300 flex items-center gap-1">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        Solo Premium
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSaveReward}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Aggiungi
                    </button>
                    <button
                      onClick={() => { setShowRewardForm(false); resetRewardForm(); }}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {passRewards.length === 0 ? (
                <div className="text-center text-amber-400 py-8">Nessuna ricompensa in questo pass</div>
              ) : (
                <div className="space-y-2">
                  {passRewards.sort((a, b) => a.level - b.level).map((reward) => (
                    <div
                      key={reward.id}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        reward.isPremium 
                          ? 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-yellow-500/30' 
                          : 'bg-amber-800/30 border-amber-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-700/50 rounded-lg flex items-center justify-center">
                          <span className="text-lg font-bold text-white">{reward.level}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Gift className="w-4 h-4 text-amber-400" />
                            <span className="text-white font-medium">{getRewardTypeLabel(reward.rewardType)}</span>
                            {reward.isPremium && (
                              <Crown className="w-4 h-4 text-yellow-400" />
                            )}
                          </div>
                          <p className="text-sm text-amber-300">{reward.rewardValue}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteReward(reward.id)}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
