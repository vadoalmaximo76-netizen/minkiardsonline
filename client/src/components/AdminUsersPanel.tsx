import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Shield, ShieldOff, Trash2, Edit2, Check, ChevronLeft, ChevronRight, AlertTriangle, Users, Coins, Star, Ban, RefreshCw } from 'lucide-react';

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  puntiRankiard: number;
  gamesPlayed: number;
  gamesWon: number;
  isAdmin: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  createdAt: string;
  totalCredits: number;
  freeCredits: number;
  paidCredits: number;
  isBanned: boolean;
}

interface Props {
  onClose: () => void;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

const BAN_DURATIONS = [
  { label: '1 giorno', days: 1 },
  { label: '3 giorni', days: 3 },
  { label: '7 giorni', days: 7 },
  { label: '30 giorni', days: 30 },
  { label: '90 giorni', days: 90 },
  { label: 'Permanente (3650 gg)', days: 3650 },
];

export const AdminUsersPanel: React.FC<Props> = ({ onClose }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Edit credits
  const [editingCredits, setEditingCredits] = useState<number | null>(null);
  const [editFree, setEditFree] = useState('');
  const [editPaid, setEditPaid] = useState('');

  // Edit PR
  const [editingPR, setEditingPR] = useState<number | null>(null);
  const [editPRValue, setEditPRValue] = useState('');

  // Ban dialog
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [banDays, setBanDays] = useState(7);
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Action feedback
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const fetchUsers = useCallback(async (pg = page, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (q.trim()) params.set('search', q.trim());
      const res = await fetch(`/api/admin/users?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore'); return; }
      setUsers(data.users);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(1, search); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchUsers(newPage, search);
  };

  // Save credits
  const saveCredits = async (userId: number) => {
    const freeCredits = parseInt(editFree, 10);
    const paidCredits = parseInt(editPaid, 10);
    if (isNaN(freeCredits) || isNaN(paidCredits) || freeCredits < 0 || paidCredits < 0) {
      showMsg('Valori non validi', false); return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ freeCredits, paidCredits }),
      });
      if (!res.ok) { showMsg('Errore aggiornamento', false); return; }
      showMsg('Crediti aggiornati', true);
      setEditingCredits(null);
      fetchUsers(page, search);
    } catch { showMsg('Errore di rete', false); }
  };

  // Save PR
  const savePR = async (userId: number) => {
    const pr = parseInt(editPRValue, 10);
    if (isNaN(pr) || pr < 0) { showMsg('Valore non valido', false); return; }
    try {
      const res = await fetch(`/api/admin/users/${userId}/pr`, {
        method: 'PATCH', headers: getAuthHeaders(),
        body: JSON.stringify({ puntiRankiard: pr }),
      });
      if (!res.ok) { showMsg('Errore aggiornamento PR', false); return; }
      showMsg('PR aggiornati', true);
      setEditingPR(null);
      fetchUsers(page, search);
    } catch { showMsg('Errore di rete', false); }
  };

  // Ban user
  const handleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${banTarget.id}/ban`, {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ durationDays: banDays, reason: banReason }),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.error || 'Errore ban', false); return; }
      showMsg(`${banTarget.username} sospeso per ${banDays} giorni`, true);
      setBanTarget(null);
      setBanReason('');
      setBanDays(7);
      fetchUsers(page, search);
    } catch { showMsg('Errore di rete', false); }
    finally { setBanLoading(false); }
  };

  // Unban user
  const handleUnban = async (user: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/unban`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (!res.ok) { showMsg('Errore sban', false); return; }
      showMsg(`${user.username} sban effettuato`, true);
      fetchUsers(page, search);
    } catch { showMsg('Errore di rete', false); }
  };

  // Delete user
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (!res.ok) { const d = await res.json(); showMsg(d.error || 'Errore eliminazione', false); return; }
      showMsg(`${deleteTarget.username} eliminato`, true);
      setDeleteTarget(null);
      fetchUsers(page, search);
    } catch { showMsg('Errore di rete', false); }
    finally { setDeleteLoading(false); }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const banUntilFormatted = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gray-950/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-bold text-lg">Gestione Account</h2>
          <span className="text-white/40 text-sm">{total} utenti totali</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchUsers(page, search)} className="p-2 text-white/40 hover:text-white/70 rounded-lg hover:bg-white/10 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white/70 rounded-lg hover:bg-white/10 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-white/10 bg-gray-950/60 flex-shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per username o email..."
              className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all">
            Cerca
          </button>
        </form>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`mx-5 mt-3 flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${actionMsg.ok ? 'bg-green-900/50 border border-green-500/40 text-green-300' : 'bg-red-900/50 border border-red-500/40 text-red-300'}`}>
          <Check className="w-4 h-4" />
          {actionMsg.text}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        ) : users.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-8">Nessun utente trovato</div>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div
                key={user.id}
                className={`bg-white/5 border rounded-xl p-4 transition-all ${user.isBanned ? 'border-red-500/30 bg-red-950/20' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm">{user.username}</span>
                      {user.isAdmin && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-600/30 border border-yellow-500/30 text-yellow-300 rounded-full">Admin</span>
                      )}
                      {user.isBanned && (
                        <span className="text-xs px-2 py-0.5 bg-red-600/30 border border-red-500/30 text-red-300 rounded-full flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Sospeso fino al {banUntilFormatted(user.bannedUntil)}
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">{user.email || '—'}</p>
                    {user.isBanned && user.banReason && (
                      <p className="text-red-300/60 text-xs mt-0.5">Motivo: {user.banReason}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-white/30 text-xs">ID: {user.id}</span>
                      <span className="text-white/30 text-xs">{user.gamesPlayed} partite</span>
                      <span className="text-white/30 text-xs">Reg. {formatDate(user.createdAt)}</span>
                    </div>
                  </div>

                  {/* Credits */}
                  <div className="flex flex-col gap-1 min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      {editingCredits === user.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={editFree} onChange={e => setEditFree(e.target.value)} placeholder="Free" className="w-16 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-white text-xs" />
                          <span className="text-white/30 text-xs">+</span>
                          <input type="number" value={editPaid} onChange={e => setEditPaid(e.target.value)} placeholder="Paid" className="w-16 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-white text-xs" />
                          <button onClick={() => saveCredits(user.id)} className="p-1 bg-green-600 rounded text-white hover:bg-green-500"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditingCredits(null)} className="p-1 bg-white/10 rounded text-white/50 hover:bg-white/20"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCredits(user.id); setEditFree(String(user.freeCredits)); setEditPaid(String(user.paidCredits)); }}
                          className="flex items-center gap-1 group"
                        >
                          <span className="text-amber-300 text-xs font-medium">{user.totalCredits.toLocaleString()} crediti</span>
                          <Edit2 className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      {editingPR === user.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={editPRValue} onChange={e => setEditPRValue(e.target.value)} className="w-24 px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-white text-xs" />
                          <button onClick={() => savePR(user.id)} className="p-1 bg-green-600 rounded text-white hover:bg-green-500"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditingPR(null)} className="p-1 bg-white/10 rounded text-white/50 hover:bg-white/20"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingPR(user.id); setEditPRValue(String(user.puntiRankiard)); }}
                          className="flex items-center gap-1 group"
                        >
                          <span className="text-purple-300 text-xs font-medium">{user.puntiRankiard.toLocaleString()} PR</span>
                          <Edit2 className="w-3 h-3 text-white/20 group-hover:text-white/50 transition-colors" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {user.isBanned ? (
                      <button
                        onClick={() => handleUnban(user)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700/30 hover:bg-green-700/50 border border-green-600/30 rounded-lg text-green-300 text-xs font-semibold transition-all"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        Sbanna
                      </button>
                    ) : (
                      <button
                        onClick={() => { setBanTarget(user); setBanReason(''); setBanDays(7); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-700/30 hover:bg-orange-700/50 border border-orange-600/30 rounded-lg text-orange-300 text-xs font-semibold transition-all"
                        disabled={user.isAdmin}
                        title={user.isAdmin ? 'Non puoi bannare un admin' : undefined}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Sospendi
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/30 hover:bg-red-700/50 border border-red-600/30 rounded-lg text-red-300 text-xs font-semibold transition-all"
                      disabled={user.isAdmin}
                      title={user.isAdmin ? 'Non puoi eliminare un admin' : undefined}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-white/10 bg-gray-950/60 flex-shrink-0">
          <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/50 text-sm">Pagina {page} di {totalPages}</span>
          <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ban Dialog */}
      {banTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Ban className="w-5 h-5 text-orange-400" />
              <h3 className="text-white font-bold">Sospendi account</h3>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Stai per sospendere <span className="text-white font-semibold">{banTarget.username}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-white/50 text-xs block mb-1.5">Durata</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BAN_DURATIONS.map(d => (
                    <button
                      key={d.days}
                      onClick={() => setBanDays(d.days)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition-all border ${banDays === d.days ? 'bg-orange-600/40 border-orange-500/60 text-orange-200' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-white/50 text-xs block mb-1.5">Motivazione (opzionale)</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Es: comportamento scorretto..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setBanTarget(null)} className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white/60 font-semibold rounded-xl text-sm transition-all">
                Annulla
              </button>
              <button onClick={handleBan} disabled={banLoading} className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                {banLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Ban className="w-4 h-4" />}
                Sospendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-bold">Elimina account</h3>
            </div>
            <p className="text-white/60 text-sm mb-1">
              Stai per eliminare permanentemente l'account di:
            </p>
            <p className="text-white font-bold text-lg mb-1">{deleteTarget.username}</p>
            <p className="text-red-300/70 text-xs mb-4">
              Questa azione è irreversibile. Tutti i dati verranno persi.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white/60 font-semibold rounded-xl text-sm transition-all">
                Annulla
              </button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                {deleteLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Elimina definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
