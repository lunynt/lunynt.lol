import { guestbook } from '../config';

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

function normalize(text: string): string {
  let result = '';
  for (const ch of text.toLowerCase()) {
    result += LEET_MAP[ch] ?? ch;
  }
  return result.replace(/[^a-z\s]/g, ' ');
}

const SLUR_WORDS = [
  'nigger',
  'nigga',
  'chink',
  'gook',
  'spic',
  'kike',
  'wetback',
  'beaner',
  'coon',
  'paki',
  'raghead',
  'sandnigger',
  'tranny',
  'faggot',
  'fag',
  'dyke',
  'retard',
  'retarded',
  'cripple',
];

const SLUR_PATTERN = new RegExp(`\\b(${SLUR_WORDS.join('|')})\\b`, 'i');

const XSS_PATTERNS = [
  /<[^>]*script/i,
  /<[^>]*iframe/i,
  /<[^>]*object/i,
  /<[^>]*embed/i,
  /<[^>]*link/i,
  /<[^>]*style/i,
  /<[^>]*meta/i,
  /<[^>]*base/i,
  /<[^>]*form/i,
  /on\w+\s*=/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /srcdoc\s*=/i,
  /href\s*=\s*["']?\s*javascript/i,
  /expression\s*\(/i,
];

export function isNameBlacklisted(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return guestbook.nameBlacklist.some((blocked) => normalized === blocked.toLowerCase());
}

export function containsSlur(text: string): boolean {
  return SLUR_PATTERN.test(normalize(text));
}

export function containsXss(text: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(text));
}

export function isSpam(text: string): boolean {
  return containsSlur(text) || containsXss(text);
}
