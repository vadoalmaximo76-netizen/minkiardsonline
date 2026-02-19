import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { jsonStorage } from './jsonStorage';
import { emitSync } from './dbSync';

const CARD_DATA_PATH = path.join(process.cwd(), 'client/src/lib/cardData.ts');

const MIN_CONFIDENCE = 30;
const MIN_ALPHA_RATIO = 0.3;
const MIN_TEXT_LENGTH = 5;

let ocrRunning = false;

export function isOcrRunning(): boolean {
  return ocrRunning;
}

function getBonusCardUrls(): string[] {
  const content = fs.readFileSync(CARD_DATA_PATH, 'utf-8');
  const bonusMatch = content.match(/bonus:\s*\[([\s\S]*?)\]/);
  if (!bonusMatch) return [];
  const urls = bonusMatch[1].match(/"https?:\/\/[^"]+"/g) || [];
  return urls.map(u => u.replace(/"/g, ''));
}

function getBonusIdsWithEffect(): Set<string> {
  const mods = jsonStorage.cardModifications.getAll();
  const ids = new Set<string>();
  for (const m of mods) {
    if (m.originalCardId?.startsWith('bonus-') && m.effect?.trim()) {
      ids.add(m.originalCardId);
    }
  }
  return ids;
}

function getCardNameFromUrl(url: string): string {
  try {
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];
    return decodeURIComponent(filename)
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadImage(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

function cleanOcrText(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isQualityAcceptable(text: string, confidence: number): boolean {
  if (confidence < MIN_CONFIDENCE) return false;
  if (text.length < MIN_TEXT_LENGTH) return false;
  const alphaChars = (text.match(/[a-zA-ZàèéìòùÀÈÉÌÒÙ]/g) || []).length;
  const ratio = alphaChars / text.length;
  if (ratio < MIN_ALPHA_RATIO) return false;
  return true;
}

export interface OcrResult {
  cardId: string;
  cardName: string;
  imageUrl: string;
  extractedText: string;
  confidence: number;
  success: boolean;
  needsReview: boolean;
  error?: string;
}

export async function ocrSingleCard(cardId: string, imageUrl: string): Promise<OcrResult> {
  const cardName = getCardNameFromUrl(imageUrl);
  try {
    console.log(`🔍 OCR processing ${cardId}: ${cardName}...`);
    const imageBuffer = await downloadImage(imageUrl);

    const result = await Tesseract.recognize(imageBuffer, 'ita', {
      logger: () => {},
    });

    const extractedText = cleanOcrText(result.data.text);
    const confidence = result.data.confidence;
    const qualityOk = isQualityAcceptable(extractedText, confidence);

    console.log(`  ${qualityOk ? '✅' : '⚠️'} ${cardId} (${confidence.toFixed(1)}%): "${extractedText.substring(0, 80)}${extractedText.length > 80 ? '...' : ''}"`);

    return {
      cardId,
      cardName,
      imageUrl,
      extractedText,
      confidence,
      success: extractedText.length > 3,
      needsReview: !qualityOk,
    };
  } catch (error: any) {
    console.error(`  ❌ ${cardId}: ${error.message}`);
    return {
      cardId,
      cardName,
      imageUrl,
      extractedText: '',
      confidence: 0,
      success: false,
      needsReview: true,
      error: error.message,
    };
  }
}

export async function ocrAllMissingBonusCards(onProgress?: (done: number, total: number) => void): Promise<{
  results: OcrResult[];
  totalProcessed: number;
  successCount: number;
  failCount: number;
  needsReviewCount: number;
}> {
  if (ocrRunning) {
    throw new Error('OCR is already running. Please wait for the current run to complete.');
  }

  ocrRunning = true;
  try {
    const urls = getBonusCardUrls();
    const idsWithEffect = getBonusIdsWithEffect();

    const cardsToProcess: { cardId: string; url: string }[] = [];
    for (let i = 0; i < urls.length; i++) {
      const cardId = `bonus-${i}`;
      if (!idsWithEffect.has(cardId)) {
        cardsToProcess.push({ cardId, url: urls[i] });
      }
    }

    console.log(`\n🃏 OCR: ${cardsToProcess.length} BONUS cards to process (${idsWithEffect.size} already have effects)\n`);

    const results: OcrResult[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < cardsToProcess.length; i += BATCH_SIZE) {
      const batch = cardsToProcess.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(c => ocrSingleCard(c.cardId, c.url))
      );
      results.push(...batchResults);

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, cardsToProcess.length), cardsToProcess.length);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const needsReviewCount = results.filter(r => r.needsReview).length;

    console.log(`\n📊 OCR Results: ${successCount} success, ${failCount} failed, ${needsReviewCount} need review out of ${results.length} total\n`);

    return { results, totalProcessed: results.length, successCount, failCount, needsReviewCount };
  } finally {
    ocrRunning = false;
  }
}

export function saveOcrResultsToModifications(results: OcrResult[]): { saved: number; pendingReview: number; skipped: number } {
  let saved = 0;
  let pendingReview = 0;
  let skipped = 0;

  for (const result of results) {
    if (!result.success || !result.extractedText) {
      skipped++;
      continue;
    }

    const existing = jsonStorage.cardModifications.getByOriginalCardId(result.cardId);
    if (existing?.effect?.trim() && existing.modifiedBy !== 'ocr-auto') {
      skipped++;
      continue;
    }

    const modData: Record<string, any> = {
      deckType: 'bonus',
      modifiedBy: 'ocr-auto',
      ocrText: result.extractedText,
      ocrConfidence: result.confidence,
    };

    if (result.needsReview) {
      modData.ocrPendingReview = true;
      pendingReview++;
    } else {
      modData.effect = result.extractedText;
      modData.ocrPendingReview = false;
      saved++;
    }

    jsonStorage.cardModifications.upsert(result.cardId, modData);
    emitSync('card_modifications', 'update', { originalCardId: result.cardId, ...modData }, { originalCardId: result.cardId });
  }

  console.log(`💾 OCR: ${saved} effetti salvati, ${pendingReview} in attesa di revisione, ${skipped} saltati`);

  return { saved, pendingReview, skipped };
}
