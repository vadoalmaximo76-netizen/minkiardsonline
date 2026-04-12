import React, { useEffect, useState } from 'react';
import { Loader2, Star, Zap, Swords, Shield, ArrowRight, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface LinkedCard {
  id: string;
  name: string;
  imageUrl: string;
}

interface CharacterOverride {
  cardId: string;
  name: string;
  imageUrl: string;
  usedBy: { damageValue?: number | null; effect?: string | null } | null;
  usedOn: { damageValue?: number | null; effect?: string | null } | null;
}

interface CardSheetData {
  id: string;
  deckType: string;
  name: string;
  imageUrl: string;
  pti?: number | null;
  stars?: number | null;
  effect?: string | null;
  mosseDamageValue?: number | null;
  mosseDamageEffect?: string | null;
  mosseCharacterOverrides?: Array<{
    characterName?: string;
    characterId?: string;
    usedBy?: { damageValue?: number | null; effect?: string | null } | null;
    usedOn?: { damageValue?: number | null; effect?: string | null } | null;
  }> | null;
  mosseRestrictedFrom?: any[] | null;
  mosseRestrictedAgainst?: any[] | null;
  rarity?: string | null;
  draftCost?: number | null;
  evolvesInto?: string | null;
  evolvesIntoCard?: LinkedCard | null;
  transformsInto?: string | null;
  transformsIntoCard?: LinkedCard | null;
  transformsFrom?: string | null;
  transformsFromCard?: LinkedCard | null;
  cheatsInto?: string | null;
  cheatsIntoCard?: LinkedCard | null;
  specialCategory?: string | null;
  mossesWithOverrides?: CharacterOverride[];
  bonusesWithOverrides?: CharacterOverride[];
  evolvesFrom?: LinkedCard | null;
  transformsFromSource?: LinkedCard | null;
  cheatsFrom?: LinkedCard | null;
}

interface CardInfoSheetProps {
  cardId: string;
  compact?: boolean;
}

const RARITY_LABELS: Record<string, { label: string; color: string }> = {
  comune: { label: 'Comune', color: '#9ca3af' },
  rara: { label: 'Rara', color: '#3b82f6' },
  epica: { label: 'Epica', color: '#8b5cf6' },
  leggendaria: { label: 'Leggendaria', color: '#f59e0b' },
  rare: { label: 'Rara', color: '#3b82f6' },
  epic: { label: 'Epica', color: '#8b5cf6' },
  legendary: { label: 'Leggendaria', color: '#f59e0b' },
  common: { label: 'Comune', color: '#9ca3af' },
};

const DECK_LABELS: Record<string, string> = {
  personaggi: 'Personaggio',
  personaggi_speciali: 'Personaggio Speciale',
  mosse: 'Mossa',
  bonus: 'Bonus',
  custom: 'Carta Custom',
};

const MOSSE_EFFECT_LABELS: Record<string, string> = {
  death: 'Morte istantanea',
  halve_pti: 'Dimezza i PTI',
  zero_stars: 'Azzera le stelle',
  set_5_pti: 'PTI a 5',
  remove_1_star: 'Rimuove 1 stella',
  other: 'Effetto speciale',
};

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        {icon && <span className="text-white/70">{icon}</span>}
        <span className="text-white/80 text-xs font-bold uppercase tracking-wider flex-1">{title}</span>
        {open ? <ChevronUp size={12} className="text-white/40" /> : <ChevronDown size={12} className="text-white/40" />}
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  );
}

function StarRow({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={10} className={i < count ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'} />
      ))}
    </span>
  );
}

function LinkedCardChip({ card, label }: { card: LinkedCard; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
      <div className="text-white/40 text-[10px] font-bold uppercase w-16 shrink-0">{label}</div>
      <ArrowRight size={10} className="text-white/30 shrink-0" />
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-8 h-12 object-cover rounded"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <span className="text-white text-xs font-bold leading-tight">{card.name}</span>
    </div>
  );
}

function OverrideCard({ entry }: { entry: CharacterOverride }) {
  return (
    <div className="flex gap-2 bg-white/5 rounded-lg p-2">
      {entry.imageUrl && (
        <img
          src={entry.imageUrl}
          alt={entry.name}
          className="w-8 h-12 object-cover rounded shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-white text-[11px] font-bold truncate">{entry.name}</div>
        {entry.usedBy && (entry.usedBy.damageValue != null || entry.usedBy.effect) && (
          <div className="mt-0.5">
            <span className="text-green-400 text-[10px] font-bold">Se usata DA: </span>
            {entry.usedBy.damageValue != null && (
              <span className="text-green-300 text-[10px]">{entry.usedBy.damageValue} PTI</span>
            )}
            {entry.usedBy.effect && (
              <span className="text-green-200/70 text-[10px] ml-1">{entry.usedBy.effect}</span>
            )}
          </div>
        )}
        {entry.usedOn && (entry.usedOn.damageValue != null || entry.usedOn.effect) && (
          <div className="mt-0.5">
            <span className="text-red-400 text-[10px] font-bold">Se usata SU: </span>
            {entry.usedOn.damageValue != null && (
              <span className="text-red-300 text-[10px]">{entry.usedOn.damageValue} PTI</span>
            )}
            {entry.usedOn.effect && (
              <span className="text-red-200/70 text-[10px] ml-1">{entry.usedOn.effect}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CardInfoSheet({ cardId, compact = false }: CardInfoSheetProps) {
  const [data, setData] = useState<CardSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/cards/sheet?cardId=${encodeURIComponent(cardId)}`)
      .then(r => r.json())
      .then(j => {
        if (j.success) setData(j.card);
        else setError(j.error || 'Errore nel caricamento');
      })
      .catch(() => setError('Errore di rete'))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-white/40">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Caricamento scheda...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-4 text-center text-white/40 text-sm">
        {error || 'Nessuna informazione disponibile'}
      </div>
    );
  }

  const isChar = data.deckType === 'personaggi' || data.deckType === 'personaggi_speciali';
  const isSpeciale = data.deckType === 'personaggi_speciali';
  const isMossa = data.deckType === 'mosse';
  const isBonus = data.deckType === 'bonus';
  const rarityInfo = data.rarity ? (RARITY_LABELS[data.rarity.toLowerCase()] || { label: data.rarity, color: '#9ca3af' }) : null;

  const restrictedFrom: string[] = Array.isArray(data.mosseRestrictedFrom)
    ? data.mosseRestrictedFrom.map((x: any) => (typeof x === 'string' ? x : (x?.characterName || x?.characterId || JSON.stringify(x))))
    : [];
  const restrictedAgainst: string[] = Array.isArray(data.mosseRestrictedAgainst)
    ? data.mosseRestrictedAgainst.map((x: any) => (typeof x === 'string' ? x : (x?.characterName || x?.characterId || JSON.stringify(x))))
    : [];

  const charOverrides = Array.isArray(data.mosseCharacterOverrides) ? data.mosseCharacterOverrides : [];

  return (
    <div className="flex flex-col gap-2 text-sm" style={{ maxHeight: compact ? '60vh' : '75vh', overflowY: 'auto' }}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Card image */}
        <div className="shrink-0 w-20" style={{ aspectRatio: '2/3' }}>
          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={data.name}
              className="w-full h-full object-cover rounded-lg border border-white/20"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full rounded-lg bg-white/5 flex items-center justify-center">
              <Shield size={24} className="text-white/20" />
            </div>
          )}
        </div>
        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-sm leading-tight mb-1">{data.name}</div>
          <div className="text-white/50 text-[11px] mb-2">{DECK_LABELS[data.deckType] || data.deckType}</div>

          {/* PTI + Stars for chars */}
          {isChar && (data.pti != null || data.stars != null) && (
            <div className="flex items-center gap-3 mb-1">
              {data.pti != null && (
                <div className="flex items-center gap-1">
                  <Zap size={11} className="text-yellow-400" />
                  <span className="text-yellow-300 font-bold text-xs">{data.pti} PTI</span>
                </div>
              )}
              {data.stars != null && (
                <div className="flex items-center gap-1">
                  <StarRow count={data.stars} />
                  <span className="text-yellow-300/70 text-[10px]">x{data.stars}</span>
                </div>
              )}
            </div>
          )}

          {/* Damage for mosse */}
          {isMossa && data.mosseDamageValue != null && (
            <div className="flex items-center gap-1 mb-1">
              <Swords size={11} className="text-red-400" />
              <span className="text-red-300 font-bold text-xs">{data.mosseDamageValue} PTI danno base</span>
            </div>
          )}
          {isMossa && data.mosseDamageEffect && data.mosseDamageEffect !== 'other' && (
            <div className="text-orange-300 text-[10px] mb-1">
              ⚡ {MOSSE_EFFECT_LABELS[data.mosseDamageEffect] || data.mosseDamageEffect}
            </div>
          )}

          {/* Rarity + Draft cost */}
          <div className="flex items-center gap-2 flex-wrap">
            {rarityInfo && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ color: rarityInfo.color, borderColor: rarityInfo.color + '50', background: rarityInfo.color + '15' }}
              >
                {rarityInfo.label}
              </span>
            )}
            {data.draftCost != null && data.draftCost > 0 && (
              <span className="text-[10px] font-bold text-yellow-400/80 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                💰 {data.draftCost} crediti Draft
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Effect / Powers */}
      {data.effect && (
        <Section title="Poteri / Effetto" icon={<Zap size={12} />}>
          <p className="text-white/70 text-[11px] leading-relaxed">{data.effect}</p>
        </Section>
      )}

      {/* Transformations for personaggi */}
      {isChar && !isSpeciale && (data.evolvesIntoCard || data.transformsIntoCard || data.cheatsIntoCard) && (
        <Section title="Trasformazioni" icon={<RefreshCw size={12} />}>
          <div className="flex flex-col gap-1.5">
            {data.evolvesIntoCard && <LinkedCardChip card={data.evolvesIntoCard} label="Si evolve in" />}
            {data.transformsIntoCard && <LinkedCardChip card={data.transformsIntoCard} label="Si trasforma in" />}
            {data.cheatsIntoCard && <LinkedCardChip card={data.cheatsIntoCard} label="Si tarocca in" />}
          </div>
        </Section>
      )}

      {/* Reverse transformations for personaggi_speciali */}
      {isSpeciale && (data.evolvesFrom || data.transformsFromSource || data.cheatsFrom) && (
        <Section title="Origine" icon={<RefreshCw size={12} />}>
          <div className="flex flex-col gap-1.5">
            {data.evolvesFrom && <LinkedCardChip card={data.evolvesFrom} label="Si evolve da" />}
            {data.transformsFromSource && <LinkedCardChip card={data.transformsFromSource} label="Si trasforma da" />}
            {data.cheatsFrom && <LinkedCardChip card={data.cheatsFrom} label="Si tarocca da" />}
          </div>
        </Section>
      )}

      {/* Mosse with overrides for this character */}
      {isChar && data.mossesWithOverrides && data.mossesWithOverrides.length > 0 && (
        <Section title={`Mosse con effetti speciali (${data.mossesWithOverrides.length})`} icon={<Swords size={12} />} defaultOpen={false}>
          <div className="flex flex-col gap-1.5">
            {data.mossesWithOverrides.map((entry, i) => (
              <OverrideCard key={i} entry={entry} />
            ))}
          </div>
        </Section>
      )}

      {/* Bonus with overrides for this character */}
      {isChar && data.bonusesWithOverrides && data.bonusesWithOverrides.length > 0 && (
        <Section title={`Bonus con effetti speciali (${data.bonusesWithOverrides.length})`} icon={<Shield size={12} />} defaultOpen={false}>
          <div className="flex flex-col gap-1.5">
            {data.bonusesWithOverrides.map((entry, i) => (
              <OverrideCard key={i} entry={entry} />
            ))}
          </div>
        </Section>
      )}

      {/* Character overrides on a mosse/bonus card */}
      {(isMossa || isBonus) && charOverrides.length > 0 && (
        <Section title={`Effetti per personaggio (${charOverrides.length})`} icon={<Swords size={12} />} defaultOpen={false}>
          <div className="flex flex-col gap-1.5">
            {charOverrides.map((ov, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-2">
                <div className="text-white text-[11px] font-bold mb-1">{ov.characterName || ov.characterId || '—'}</div>
                {ov.usedBy && (ov.usedBy.damageValue != null || ov.usedBy.effect) && (
                  <div>
                    <span className="text-green-400 text-[10px] font-bold">Se usata DA: </span>
                    {ov.usedBy.damageValue != null && (
                      <span className="text-green-300 text-[10px]">{ov.usedBy.damageValue} PTI</span>
                    )}
                    {ov.usedBy.effect && (
                      <span className="text-green-200/70 text-[10px] ml-1">{ov.usedBy.effect}</span>
                    )}
                  </div>
                )}
                {ov.usedOn && (ov.usedOn.damageValue != null || ov.usedOn.effect) && (
                  <div>
                    <span className="text-red-400 text-[10px] font-bold">Se usata SU: </span>
                    {ov.usedOn.damageValue != null && (
                      <span className="text-red-300 text-[10px]">{ov.usedOn.damageValue} PTI</span>
                    )}
                    {ov.usedOn.effect && (
                      <span className="text-red-200/70 text-[10px] ml-1">{ov.usedOn.effect}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Restricted from (mosse only) */}
      {isMossa && restrictedFrom.length > 0 && (
        <Section title="Non può essere usata da" icon={<Shield size={12} />}>
          <div className="flex flex-wrap gap-1">
            {restrictedFrom.map((name, i) => (
              <span key={i} className="text-[10px] bg-red-900/40 border border-red-500/30 text-red-300 rounded px-2 py-0.5">{name}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Restricted against (mosse only) */}
      {isMossa && restrictedAgainst.length > 0 && (
        <Section title="Non può essere usata contro" icon={<Shield size={12} />}>
          <div className="flex flex-wrap gap-1">
            {restrictedAgainst.map((name, i) => (
              <span key={i} className="text-[10px] bg-orange-900/40 border border-orange-500/30 text-orange-300 rounded px-2 py-0.5">{name}</span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
