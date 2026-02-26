#!/bin/bash

# Script per configurare i segreti su Fly.io
# Esegui questo script DOPO aver fatto fly launch o fly deploy per la prima volta
# Sostituisci ogni valore con le tue credenziali reali

APP_NAME="minkiards"

echo "Impostazione segreti per l'app: $APP_NAME"
echo "Assicurati di avere flyctl installato e di essere autenticato (fly auth login)"
echo ""

fly secrets set \
  DATABASE_URL="postgresql://utente:password@host/database?sslmode=require" \
  ADMIN_FALLBACK_PASSWORD="la-tua-password-admin" \
  SESSION_SECRET="una-stringa-casuale-lunga-almeno-32-caratteri" \
  CLOUDINARY_CLOUD_NAME="il-tuo-cloud-name" \
  CLOUDINARY_API_KEY="la-tua-api-key" \
  CLOUDINARY_API_SECRET="il-tuo-api-secret" \
  FREESOUND_API_KEY="la-tua-chiave-freesound" \
  POSTHOG_API_KEY="la-tua-chiave-posthog" \
  SENTRY_DSN="il-tuo-sentry-dsn" \
  UPSTASH_REDIS_REST_URL="https://il-tuo-url.upstash.io" \
  UPSTASH_REDIS_REST_TOKEN="il-tuo-token-upstash" \
  OPENAI_API_KEY="sk-..." \
  RESEND_API_KEY="re_..." \
  --app "$APP_NAME"

echo ""
echo "Segreti impostati! Ora puoi fare il deploy con: fly deploy"
