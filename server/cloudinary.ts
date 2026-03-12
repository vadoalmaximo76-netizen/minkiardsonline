import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

/**
 * Optimization options for images
 */
interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
}

/**
 * Card size presets for the MINKIARDS card game
 */
type CardSize = 'thumb' | 'card' | 'preview' | 'full';

/**
 * Optimizes an image URL using Cloudinary's fetch delivery
 * This fetches and optimizes the image on-the-fly without requiring upload
 * 
 * @param originalUrl - The original image URL (from postimg.cc, imgur.com, etc.)
 * @param options - Optional optimization parameters
 * @returns Cloudinary-optimized image URL
 */
export function optimizeImageUrl(
  originalUrl: string,
  options?: OptimizeOptions
): string {
  if (!cloudName) {
    console.warn('CLOUDINARY_CLOUD_NAME is not set, returning original URL');
    return originalUrl;
  }

  // Default options
  const width = options?.width ?? 200;
  const height = options?.height;
  const quality = options?.quality ?? 'auto';
  const format = options?.format ?? 'auto';

  // Build transformation string
  const transformations: string[] = [];

  if (width) {
    transformations.push(`w_${width}`);
  }

  if (height) {
    transformations.push(`h_${height}`);
  }

  // Add crop strategy if both width and height are specified
  if (width && height) {
    transformations.push('c_fill');
  }

  // Add quality and format
  if (quality) {
    transformations.push(`q_${quality}`);
  }

  if (format) {
    transformations.push(`f_${format}`);
  }

  // Build the Cloudinary fetch URL
  const transformationString = transformations.join(',');
  const encodedUrl = encodeURIComponent(originalUrl);
  
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformationString}/${encodedUrl}`;
}

/**
 * Gets a pre-optimized card image URL for different display sizes
 * Useful for MINKIARDS card game where cards are displayed at various sizes
 * 
 * @param originalUrl - The original image URL
 * @param size - The desired card size: 'thumb' (80x120), 'card' (160x240), 'preview' (400x600), 'full' (no resize)
 * @returns Cloudinary-optimized card image URL
 */
export function getOptimizedCardUrl(
  originalUrl: string,
  size: CardSize = 'card'
): string {
  if (!cloudName) {
    console.warn('CLOUDINARY_CLOUD_NAME is not set, returning original URL');
    return originalUrl;
  }

  let transformationString = '';

  switch (size) {
    case 'thumb':
      // Small thumbnail: 80x120
      transformationString = 'w_80,h_120,c_fill,q_auto,f_auto';
      break;
    case 'card':
      // Standard card size: 160x240
      transformationString = 'w_160,h_240,c_fill,q_auto,f_auto';
      break;
    case 'preview':
      // Large preview: 400x600
      transformationString = 'w_400,h_600,c_fill,q_auto,f_auto';
      break;
    case 'full':
      // No resize, just optimize
      transformationString = 'q_auto,f_auto';
      break;
    default:
      // Default to card size if invalid size provided
      transformationString = 'w_160,h_240,c_fill,q_auto,f_auto';
  }

  const encodedUrl = encodeURIComponent(originalUrl);
  
  return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformationString}/${encodedUrl}`;
}

/**
 * Checks if Cloudinary is properly configured
 * @returns true if all required environment variables are set
 */
export function isCloudinaryConfigured(): boolean {
  return !!(cloudName && apiKey && apiSecret);
}

export { cloudinary as cloudinaryInstance };

export default {
  optimizeImageUrl,
  getOptimizedCardUrl,
  isCloudinaryConfigured,
};
