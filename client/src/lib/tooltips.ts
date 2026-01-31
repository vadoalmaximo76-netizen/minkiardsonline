export interface TooltipData {
  keyword: string;
  description: string;
}

export const CARD_KEYWORDS: Record<string, string> = {
  "PERSONAGGI": "Carte combattenti principali con PTI e Stelle.",
  "MOSSE": "Carte attacco utilizzate per infliggere danni o effetti.",
  "BONUS": "Carte potenziamento applicabili ai personaggi in campo.",
  "SPECIALI": "Carte personaggi potenti con effetti unici.",
  "PTI": "Punti Vita del personaggio. Se arrivano a 0, la carta va nel cimitero.",
  "Stelle": "Livello di potenza del personaggio, usato per calcolare i danni.",
  "PARASSITA": "Carta che si aggancia a un personaggio nemico per danneggiarlo ogni turno.",
  "SAIBAIM": "Creatura che esplode infliggendo danni a tutti i personaggi.",
  "OSTAGGIO": "Cattura un personaggio nemico per 3 turni.",
  "ASSICURAZIONE": "Protegge un personaggio dalla morte ripristinando i PTI assicurati.",
  "DUELLO": "Combattimento 1 contro 1 tra due personaggi.",
  "BAMBOLA VOODOO": "Riflette i danni subiti su un altro personaggio collegato.",
  "Poison": "Danno continuo ogni turno.",
  "Burn": "Danno da fuoco cumulativo.",
  "Freeze": "Immobilizza il personaggio impedendogli di agire.",
  "Stun": "Stordisce il personaggio per un turno.",
  "Shield": "Assorbe i danni in arrivo fino all'esaurimento.",
  "Reflect": "Riflette una parte dei danni all'attaccante.",
  "Lifesteal": "Cura l'utilizzatore in base al danno inflitto.",
  "Cimitero": "Area dove finiscono le carte eliminate dal gioco.",
  "Mazzo": "Insieme di carte da cui pescare nuovi strumenti di gioco."
};
