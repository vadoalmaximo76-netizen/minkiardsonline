# Guida al Deploy di MINKIARDS su Fly.io

Questa guida ti porta dal codice sorgente a un'app live su Fly.io, senza bisogno di Replit Core.

---

## Prerequisiti

- Un account su [fly.io](https://fly.io) (piano gratuito sufficiente per iniziare)
- Un database PostgreSQL esterno (es. [Neon](https://neon.tech) - piano gratuito disponibile)
- Il codice del progetto scaricato dal tuo Replit

---

## 1. Scarica il codice da Replit

Nel tuo Replit, clicca sui tre puntini in alto a sinistra → **Download as zip**.  
Estrai lo zip sul tuo computer.

---

## 2. Installa flyctl

**macOS / Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows:**
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Poi accedi:
```bash
fly auth login
```

---

## 3. Prima configurazione

Nella cartella del progetto estratto, esegui:
```bash
fly launch --no-deploy
```

Fly ti chiederà:
- **Nome app**: scegli un nome unico (es. `minkiards-gioco`)
- **Regione**: scegli `fra` (Frankfurt) per l'Italia
- **Database**: di' **No** (usiamo Neon che hai già)

> **Importante**: se Fly sovrascrive il `fly.toml`, ricopia il file originale dalla cartella — contiene già la configurazione ottimale.

---

## 4. Imposta i segreti (variabili d'ambiente)

Apri il file `fly-setup.sh` e sostituisci ogni valore segnaposto con le tue credenziali reali:

| Variabile | Dove trovarla |
|---|---|
| `DATABASE_URL` | Dashboard di Neon → Connection string |
| `ADMIN_FALLBACK_PASSWORD` | Scegli tu una password per l'admin |
| `SESSION_SECRET` | Genera una stringa casuale lunga (es. 32+ caratteri) |
| `CLOUDINARY_*` | Dashboard di Cloudinary |
| `FREESOUND_API_KEY` | Account Freesound → API keys |
| `POSTHOG_API_KEY` | Dashboard PostHog |
| `SENTRY_DSN` | Dashboard Sentry → DSN del progetto |
| `UPSTASH_REDIS_*` | Dashboard Upstash → REST API |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `RESEND_API_KEY` | app.resend.com → API keys |

Poi esegui lo script (sostituisci `minkiards` con il nome che hai scelto):
```bash
chmod +x fly-setup.sh
./fly-setup.sh
```

---

## 5. Esegui il deploy

```bash
fly deploy
```

Fly costruirà l'immagine Docker e la metterà online. Ci vorranno 3-5 minuti la prima volta.

Al termine vedrai l'URL della tua app (es. `https://minkiards-gioco.fly.dev`).

---

## 6. Migra il database

Una volta live, esegui la migrazione del database:
```bash
fly ssh console --app minkiards-gioco
# Dentro la console:
npm run db:push
exit
```

---

## 7. Comandi utili

```bash
# Controlla i log in tempo reale
fly logs --app minkiards-gioco

# Scala la memoria se il gioco è lento
fly scale memory 512 --app minkiards-gioco

# Apri l'app nel browser
fly open --app minkiards-gioco

# Aggiorna l'app dopo modifiche al codice
fly deploy
```

---

## Costi stimati su Fly.io

| Risorsa | Costo |
|---|---|
| 1 macchina 1GB RAM (shared CPU) | ~$5-7/mese |
| Database Neon (piano gratuito) | Gratuito |
| Traffico (fino a 100GB) | Gratuito |

Il piano **Hobby** di Fly.io (gratuito) include crediti mensili che spesso coprono una macchina piccola. Verifica i prezzi aggiornati su [fly.io/pricing](https://fly.io/pricing).

---

## Dominio personalizzato (opzionale)

```bash
fly certs create tuodominio.it --app minkiards-gioco
```

Poi aggiungi il record CNAME nel tuo DNS:
```
tuodominio.it  CNAME  minkiards-gioco.fly.dev
```
