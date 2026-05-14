/**
 * Translation Utility for YouTube Transcripts
 * Detects non-English content and translates to English automatically
 */

/**
 * Detects if text is primarily in English
 * @param {string} text - Text to analyze
 * @returns {boolean} - True if text is in English
 */
export const isEnglish = (text) => {
  if (!text || typeof text !== 'string') return true;
  
  // Check for common non-ASCII characters
  const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) || []).length / text.length;
  
  // If more than 20% non-ASCII characters, likely not English
  if (nonAsciiRatio > 0.2) return false;
  
  // Common English words for pattern matching
  const commonEnglishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'];
  const lowerText = text.toLowerCase();
  
  // Count matches of common English words
  const matches = commonEnglishWords.filter(word => 
    lowerText.includes(` ${word} `) || 
    lowerText.startsWith(`${word} `) || 
    lowerText.endsWith(` ${word}`)
  ).length;
  
  // If we find at least 3 common English words, assume it's English
  return matches >= 3;
};

/**
 * Detects the language of the text using the browser's native API
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} - Detected language code (e.g., 'es', 'fr', 'en')
 */
export const detectLanguage = async (text) => {
  // Simple heuristic-based detection
  const sample = text.substring(0, 500); // Use first 500 chars for detection
  
  // Character-based detection patterns
  const patterns = {
    zh: /[\u4e00-\u9fff]/, // Chinese
    ja: /[\u3040-\u309f\u30a0-\u30ff]/, // Japanese
    ko: /[\uac00-\ud7af]/, // Korean
    ar: /[\u0600-\u06ff]/, // Arabic
    ru: /[\u0400-\u04ff]/, // Russian
    el: /[\u0370-\u03ff]/, // Greek
    th: /[\u0e00-\u0e7f]/, // Thai
    he: /[\u0590-\u05ff]/, // Hebrew
  };
  
  // Check for character-based languages
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(sample)) {
      return lang;
    }
  }
  
  // Check if it's English
  if (isEnglish(sample)) {
    return 'en';
  }
  
  // Default to unknown if can't detect
  return 'unknown';
};

/**
 * Translates text using MyMemory Translation API (free tier available)
 */
export const translateToEnglish = async (text, sourceLang = null) => {
  try {
    if (!text) {
      return { translatedText: text, detectedLanguage: 'en' };
    }
    
    const detectedLang = sourceLang || await detectLanguage(text);

    // Already English OR language couldn't be identified → return as-is.
    // MyMemory rejects "auto" as a source ("'AUTO' IS AN INVALID SOURCE
    // LANGUAGE"), so we can't fall back to auto-detect server-side. The
    // platform is English-only, so skipping when undetected is correct.
    if (detectedLang === 'en' || detectedLang === 'unknown' || !detectedLang) {
      return { translatedText: text, detectedLanguage: detectedLang || 'unknown' };
    }

    // Split long text into chunks (MyMemory has a 500 char limit per request)
    const chunkSize = 500;
    const chunks = [];

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    // Translate each chunk
    const translatedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const langPair = `${detectedLang}|en`;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.responseStatus === 200) {
          return data.responseData.translatedText;
        } else {
          throw new Error(data.responseDetails || 'Translation failed');
        }
      })
    );
    
    return {
      translatedText: translatedChunks.join(''),
      detectedLanguage: detectedLang
    };
    
  } catch (error) {
    console.error('Translation error:', error);
    return { translatedText: text, detectedLanguage: 'unknown', error: error.message };
  }
};

/**
 * Translates transcript with caching to avoid re-translating
 * @param {string} transcript - Transcript text
 * @param {string} videoId - Unique identifier for caching
 * @returns {Promise<{translatedText: string, detectedLanguage: string, cached: boolean}>}
 */
export const translateTranscriptWithCache = async (transcript, videoId) => {
  const cacheKey = `transcript_translation_${videoId}`;
  
  // Check if translation exists in localStorage
  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      return { ...parsed, cached: true };
    } catch (e) {
      console.error('Cache parsing error:', e);
    }
  }
  
  // Translate if not cached
  const result = await translateToEnglish(transcript);
  
  // Cache the result if successful
  if (!result.error) {
    localStorage.setItem(cacheKey, JSON.stringify({
      translatedText: result.translatedText,
      detectedLanguage: result.detectedLanguage,
      timestamp: Date.now()
    }));
  }
  
  return { ...result, cached: false };
};

/**
 * Clears old translation cache entries (older than 30 days)
 */
export const clearOldTranslationCache = () => {
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const now = Date.now();
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('transcript_translation_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data.timestamp && (now - data.timestamp) > maxAge) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        // Invalid cache entry, remove it
        localStorage.removeItem(key);
      }
    }
  });
};