import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Save, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Edit2, List } from 'lucide-react';
import { Button } from './ui/button';

interface SlideData {
  title: string;
  body: string;
  imageUrl: string;
}

type TooltipSize = 'small' | 'medium' | 'large';
type ImagePosition = 'top' | 'bottom' | 'left' | 'right';
type ShowMode = 'always' | 'first_visit';

interface PageTooltipForm {
  title: string;
  body: string;
  bgColor: string;
  textColor: string;
  size: TooltipSize;
  imageUrl: string;
  imagePosition: ImagePosition;
  isSlide: boolean;
  slides: SlideData[];
  showMode: ShowMode;
  isActive: boolean;
  priority: number;
}

interface PageTooltipRecord extends PageTooltipForm {
  id: number;
  pageRoute: string;
}

interface AdminPageTooltipFabProps {
  currentRoute: string;
  isAdmin: boolean;
}

const defaultForm = (): PageTooltipForm => ({
  title: '',
  body: '',
  bgColor: '#1e1b4b',
  textColor: '#ffffff',
  size: 'medium',
  imageUrl: '',
  imagePosition: 'top',
  isSlide: false,
  slides: [{ title: '', body: '', imageUrl: '' }],
  showMode: 'always',
  isActive: true,
  priority: 0,
});

type ViewState = 'list' | 'create' | 'edit';

export const AdminPageTooltipFab: React.FC<AdminPageTooltipFabProps> = ({ currentRoute, isAdmin }) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewState>('list');
  const [form, setForm] = useState<PageTooltipForm>(defaultForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [existingTooltips, setExistingTooltips] = useState<PageTooltipRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const authToken = localStorage.getItem('authToken');

  const loadTooltips = useCallback(async () => {
    if (!authToken) return;
    setLoadingList(true);
    try {
      const res = await fetch('/api/admin/page-tooltips', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.tooltips) {
        const forRoute: PageTooltipRecord[] = (data.tooltips as PageTooltipRecord[]).filter(
          (t) => t.pageRoute === currentRoute
        );
        setExistingTooltips(forRoute);
      }
    } catch {
      // ignore network errors on list
    }
    setLoadingList(false);
  }, [authToken, currentRoute]);

  useEffect(() => {
    if (open) {
      setView('list');
      setSavedMsg('');
      loadTooltips();
    }
  }, [open, currentRoute, loadTooltips]);

  if (!isAdmin) return null;

  const openCreate = () => {
    setForm(defaultForm());
    setEditingId(null);
    setSavedMsg('');
    setView('create');
  };

  const openEdit = (tooltip: PageTooltipRecord) => {
    setForm({
      title: tooltip.title,
      body: tooltip.body,
      bgColor: tooltip.bgColor,
      textColor: tooltip.textColor,
      size: tooltip.size,
      imageUrl: tooltip.imageUrl || '',
      imagePosition: tooltip.imagePosition,
      isSlide: tooltip.isSlide,
      slides: tooltip.slides && tooltip.slides.length > 0 ? tooltip.slides : [{ title: '', body: '', imageUrl: '' }],
      showMode: tooltip.showMode,
      isActive: tooltip.isActive,
      priority: tooltip.priority,
    });
    setEditingId(tooltip.id);
    setSavedMsg('');
    setView('edit');
  };

  const handleSave = async () => {
    if (form.isSlide) {
      const hasContent = form.slides.some(s => s.title.trim() || s.body.trim());
      if (!hasContent) {
        setSavedMsg('Almeno uno step deve avere titolo o testo');
        return;
      }
    } else {
      if (!form.title.trim() || !form.body.trim()) {
        setSavedMsg('Titolo e testo sono obbligatori');
        return;
      }
    }

    setSaving(true);
    setSavedMsg('');
    try {
      const payload = {
        pageRoute: currentRoute,
        title: form.title,
        body: form.body,
        bgColor: form.bgColor,
        textColor: form.textColor,
        size: form.size,
        imageUrl: form.imageUrl || null,
        imagePosition: form.imagePosition,
        isSlide: form.isSlide,
        slides: form.isSlide ? form.slides : [],
        showMode: form.showMode,
        isActive: form.isActive,
        priority: form.priority,
      };

      const isEditing = view === 'edit' && editingId !== null;
      const url = isEditing ? `/api/admin/page-tooltips/${editingId}` : '/api/admin/page-tooltips';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSavedMsg('Tooltip salvato!');
        await loadTooltips();
        setTimeout(() => {
          setSavedMsg('');
          setView('list');
        }, 1000);
      } else {
        setSavedMsg(data.error || 'Errore nel salvataggio');
      }
    } catch {
      setSavedMsg('Errore di rete');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Eliminare questo tooltip?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/page-tooltips/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        await loadTooltips();
      }
    } catch {
      // ignore
    }
    setDeletingId(null);
  };

  const updateSlide = (idx: number, field: keyof SlideData, value: string) => {
    const updated = form.slides.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    setForm(f => ({ ...f, slides: updated }));
  };

  const addSlide = () => setForm(f => ({ ...f, slides: [...f.slides, { title: '', body: '', imageUrl: '' }] }));
  const removeSlide = (idx: number) => setForm(f => ({ ...f, slides: f.slides.filter((_, i) => i !== idx) }));

  const routeLabel = currentRoute === '/' ? 'Home' : currentRoute.replace(/^\//, '').replace(/-/g, ' ');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-[100] w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110"
        title="Gestisci tooltip per questa pagina"
      >
        <Plus size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[110] p-2 sm:p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900 border-b border-purple-500/20 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div>
                <h3 className="text-white font-bold text-base">
                  {view === 'list' ? 'Tooltip Pagina' : view === 'create' ? 'Nuovo Tooltip' : 'Modifica Tooltip'}
                </h3>
                <p className="text-purple-400 text-xs mt-0.5 capitalize">{routeLabel} <span className="text-white/30">({currentRoute})</span></p>
              </div>
              <div className="flex items-center gap-2">
                {view !== 'list' && (
                  <button onClick={() => setView('list')} className="text-white/50 hover:text-white p-1" title="Torna alla lista">
                    <List size={16} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            {view === 'list' && (
              <div className="p-5 space-y-3">
                <Button onClick={openCreate} size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus size={14} className="mr-1" /> Crea nuovo tooltip
                </Button>
                {loadingList ? (
                  <p className="text-white/50 text-sm text-center py-4">Caricamento...</p>
                ) : existingTooltips.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-4">Nessun tooltip per questa pagina</p>
                ) : (
                  existingTooltips.map(tooltip => (
                    <div key={tooltip.id} className="bg-slate-800 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tooltip.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                          <span className="text-white text-sm font-medium truncate">{tooltip.title || (tooltip.isSlide ? `[Slide: ${tooltip.slides?.length ?? 0} step]` : '(senza titolo)')}</span>
                        </div>
                        {!tooltip.isSlide && (
                          <p className="text-white/50 text-xs truncate">{tooltip.body}</p>
                        )}
                        <div className="flex gap-2 mt-1">
                          <span className="text-white/30 text-xs">{tooltip.showMode === 'first_visit' ? 'Prima visita' : 'Sempre'}</span>
                          <span className="text-white/30 text-xs">·</span>
                          <span className="text-white/30 text-xs capitalize">{tooltip.size}</span>
                          <span className="text-white/30 text-xs">·</span>
                          <span className="text-white/30 text-xs">P:{tooltip.priority}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => openEdit(tooltip)} className="text-purple-400 hover:text-purple-300 p-1" title="Modifica">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(tooltip.id)}
                          disabled={deletingId === tooltip.id}
                          className="text-red-400 hover:text-red-300 p-1 disabled:opacity-50"
                          title="Elimina"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {(view === 'create' || view === 'edit') && (
              <div className="p-5 space-y-4">
                {!form.isSlide && (
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Titolo *</label>
                    <input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-purple-500 outline-none"
                      placeholder="Titolo del tooltip"
                    />
                  </div>
                )}

                {!form.isSlide && (
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Testo *</label>
                    <textarea
                      value={form.body}
                      onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                      className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-purple-500 outline-none min-h-[80px] resize-none"
                      placeholder="Contenuto del messaggio"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Colore sfondo</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.bgColor} onChange={e => setForm(f => ({ ...f, bgColor: e.target.value }))} className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent" />
                      <span className="text-white/50 text-xs">{form.bgColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Colore testo</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.textColor} onChange={e => setForm(f => ({ ...f, textColor: e.target.value }))} className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent" />
                      <span className="text-white/50 text-xs">{form.textColor}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Dimensione</label>
                    <select
                      value={form.size}
                      onChange={e => setForm(f => ({ ...f, size: e.target.value as TooltipSize }))}
                      className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-purple-500 outline-none"
                    >
                      <option value="small">Piccola</option>
                      <option value="medium">Media</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Modalità</label>
                    <select
                      value={form.showMode}
                      onChange={e => setForm(f => ({ ...f, showMode: e.target.value as ShowMode }))}
                      className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-purple-500 outline-none"
                    >
                      <option value="always">Sempre</option>
                      <option value="first_visit">Solo prima visita</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-white/70 text-xs font-medium block mb-1">URL Immagine (opzionale)</label>
                  <input
                    value={form.imageUrl}
                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-purple-500 outline-none"
                    placeholder="https://..."
                  />
                </div>

                {form.imageUrl && (
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Posizione immagine</label>
                    <div className="flex gap-2">
                      {(['top', 'bottom', 'left', 'right'] as const).map(pos => (
                        <button
                          key={pos}
                          onClick={() => setForm(f => ({ ...f, imagePosition: pos }))}
                          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs transition-colors ${form.imagePosition === pos ? 'bg-purple-600 text-white' : 'bg-slate-800 text-white/50 hover:bg-slate-700'}`}
                        >
                          {pos === 'top' && <ArrowUp size={12} />}
                          {pos === 'bottom' && <ArrowDown size={12} />}
                          {pos === 'left' && <ArrowLeft size={12} />}
                          {pos === 'right' && <ArrowRight size={12} />}
                          <span>{pos === 'top' ? 'Sopra' : pos === 'bottom' ? 'Sotto' : pos === 'left' ? 'Sinistra' : 'Destra'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setForm(f => ({ ...f, isSlide: !f.isSlide }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.isSlide ? 'bg-purple-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.isSlide ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-white/70 text-sm">Modalità slide (più step)</span>
                </div>

                {form.isSlide && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-xs font-medium">Step slide</span>
                      <button onClick={addSlide} className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1">
                        <Plus size={12} /> Aggiungi step
                      </button>
                    </div>
                    {form.slides.map((slide, idx) => (
                      <div key={idx} className="bg-slate-800/60 border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/50 text-xs">Step {idx + 1}</span>
                          {form.slides.length > 1 && (
                            <button onClick={() => removeSlide(idx)} className="text-red-400 hover:text-red-300">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <input
                          value={slide.title}
                          onChange={e => updateSlide(idx, 'title', e.target.value)}
                          className="w-full bg-slate-700 text-white rounded-lg px-3 py-1.5 text-xs border border-white/10 outline-none"
                          placeholder="Titolo step"
                        />
                        <textarea
                          value={slide.body}
                          onChange={e => updateSlide(idx, 'body', e.target.value)}
                          className="w-full bg-slate-700 text-white rounded-lg px-3 py-1.5 text-xs border border-white/10 outline-none min-h-[50px] resize-none"
                          placeholder="Testo step"
                        />
                        <input
                          value={slide.imageUrl}
                          onChange={e => updateSlide(idx, 'imageUrl', e.target.value)}
                          className="w-full bg-slate-700 text-white/70 rounded-lg px-3 py-1.5 text-xs border border-white/10 outline-none"
                          placeholder="URL immagine step (opzionale)"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/70 text-xs font-medium block mb-1">Priorità</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-purple-500 outline-none"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${form.isActive ? 'bg-green-600' : 'bg-slate-700'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.isActive ? 'left-5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-white/70 text-sm">Attivo</span>
                    </label>
                  </div>
                </div>

                {savedMsg && (
                  <div className={`rounded-lg px-3 py-2 text-sm ${savedMsg.includes('salvato') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    {savedMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => setView('list')} variant="outline" size="sm" className="flex-1 border-white/20 text-white/70">
                    Annulla
                  </Button>
                  <Button onClick={handleSave} disabled={saving} size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                    <Save size={14} className="mr-1" /> {saving ? 'Salvando...' : view === 'edit' ? 'Aggiorna' : 'Salva'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
