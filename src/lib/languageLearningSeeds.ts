/**
 * VATTAMS Academia language database seeds and beginner-learning starter packs.
 *
 * These are application-level seed definitions only: importing this module does not
 * write to Firebase, Supabase, or any remote database. A future migration/seed runner
 * can map LANGUAGE_DATABASE_SEEDS to its target schema.
 *
 * Starter examples are only marked "reviewed" where localized text is supplied here.
 * Other languages receive a structured beginner curriculum scaffold with explicit
 * localization status rather than invented translations.
 */
import { ACADEMIA_LANGUAGES, type AcademiaLanguage } from '@/lib/globalLanguages'

export type LanguageScriptFamily =
  | 'Latin' | 'Devanagari' | 'Bengali-Assamese' | 'Tamil' | 'Telugu'
  | 'Kannada' | 'Malayalam' | 'Gujarati' | 'Gurmukhi' | 'Arabic'
  | 'Perso-Arabic' | 'Odia' | 'Meitei-Mayek' | 'Ol-Chiki' | 'Tibetan'
  | 'CJK' | 'Thai' | 'Lao' | 'Khmer' | 'Myanmar' | 'Ethiopic'
  | 'Georgian' | 'Armenian' | 'Greek' | 'Cyrillic' | 'Hebrew'
  | 'Mixed-or-needs-review'

export type SeedReadiness = 'starter-reviewed' | 'scaffold-localization-needed'

export interface LanguageDatabaseSeed extends AcademiaLanguage {
  /** BCP-47-like application locale identifier; preserve catalogue IDs separately. */
  locale: string
  scriptFamily: LanguageScriptFamily
  writingDirection: 'ltr' | 'rtl'
  seedVersion: 1
  enabledForDiscovery: true
  contentReadiness: SeedReadiness
}

export interface LanguageStarterItem {
  id: string
  languageId: string
  unit: string
  title: string
  objective: string
  activity: string
  sampleText?: string
  sampleMeaning?: string
  pronunciationGuide?: string
  readiness: SeedReadiness
  reviewRequired: boolean
}

const SCRIPT_OVERRIDES: Record<string, LanguageScriptFamily> = {
  ar: 'Arabic', sd: 'Perso-Arabic', ur: 'Perso-Arabic', fa: 'Perso-Arabic', ps: 'Perso-Arabic', ku: 'Mixed-or-needs-review',
  as: 'Bengali-Assamese', bn: 'Bengali-Assamese', hi: 'Devanagari', mr: 'Devanagari', ne: 'Devanagari',
  sa: 'Devanagari', kok: 'Devanagari', mai: 'Devanagari', doi: 'Devanagari', bho: 'Devanagari',
  awa: 'Devanagari', mag: 'Devanagari', hne: 'Devanagari', raj: 'Devanagari', brx: 'Devanagari',
  ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', gu: 'Gujarati', pa: 'Gurmukhi',
  or: 'Odia', mni: 'Meitei-Mayek', sat: 'Ol-Chiki', ks: 'Perso-Arabic', zh: 'CJK', yue: 'CJK',
  ja: 'CJK', ko: 'CJK', bo: 'Tibetan', th: 'Thai', lo: 'Lao', km: 'Khmer', my: 'Myanmar',
  am: 'Ethiopic', ka: 'Georgian', hy: 'Armenian', el: 'Greek', he: 'Hebrew',
  ru: 'Cyrillic', uk: 'Cyrillic', bg: 'Cyrillic', be: 'Cyrillic', kk: 'Cyrillic', ky: 'Cyrillic',
  mn: 'Mixed-or-needs-review',
}
const RTL_LANGUAGES = new Set(['ar', 'sd', 'ur', 'fa', 'ps', 'he', 'ks'])
const REVIEWED_STARTER_IDS = new Set([
  'en-IN', 'ta', 'hi', 'bn', 'te', 'ml', 'kn', 'gu', 'mr', 'pa', 'ur', 'es', 'fr', 'de', 'ja', 'zh',
])

/** Initial catalogue rows suitable for mapping to a database table. */
export const LANGUAGE_DATABASE_SEEDS: readonly LanguageDatabaseSeed[] = ACADEMIA_LANGUAGES.map((language) => ({
  ...language,
  locale: language.id,
  scriptFamily: SCRIPT_OVERRIDES[language.id] ?? 'Mixed-or-needs-review',
  writingDirection: RTL_LANGUAGES.has(language.id) ? 'rtl' : 'ltr',
  seedVersion: 1,
  enabledForDiscovery: true,
  contentReadiness: REVIEWED_STARTER_IDS.has(language.id) ? 'starter-reviewed' : 'scaffold-localization-needed',
}))

const STARTER_UNITS = [
  {
    unit: 'foundation-and-sounds',
    title: 'Meet the writing system and sounds',
    objective: 'Recognize the writing system used for this language and notice its basic sound patterns.',
    activity: 'Introduce the script or spelling system, then listen to and repeat a small set of teacher-reviewed sounds.',
  },
  {
    unit: 'first-words',
    title: 'Your first useful words',
    objective: 'Understand and use a small set of everyday words in context.',
    activity: 'Match each reviewed word to a picture, meaning, and audio recording; practise recall without looking.',
  },
  {
    unit: 'greetings-and-introductions',
    title: 'Greetings and introductions',
    objective: 'Greet someone politely and introduce yourself at beginner level.',
    activity: 'Listen to a reviewed dialogue, repeat each turn, then practise a two-person role-play.',
  },
  {
    unit: 'numbers-and-things',
    title: 'Numbers and things around you',
    objective: 'Recognize beginner numbers and name familiar objects.',
    activity: 'Count real objects, pair number words with quantities, and answer short oral prompts.',
  },
  {
    unit: 'everyday-phrases',
    title: 'Useful everyday phrases',
    objective: 'Understand simple classroom and everyday requests.',
    activity: 'Choose an appropriate phrase for a situation and practise it with a partner.',
  },
] as const

/**
 * Locale examples below are conservative starter seeds, not a substitute for
 * native-speaker review. Audio/phonetics are intentionally omitted until recorded
 * or checked by a qualified language reviewer.
 */
const REVIEWED_EXAMPLES: Record<string, Record<string, { text: string; meaning: string }>> = {
  'en-IN': {
    'greetings-and-introductions': { text: 'Hello. My name is ___.', meaning: 'A simple greeting and self-introduction.' },
    'everyday-phrases': { text: 'Please. Thank you. Excuse me.', meaning: 'Polite everyday expressions.' },
  },
  ta: {
    'greetings-and-introductions': { text: 'வணக்கம். என் பெயர் ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'தயவுசெய்து. நன்றி. மன்னிக்கவும்.', meaning: 'Please. Thank you. Excuse me.' },
  },
  hi: {
    'greetings-and-introductions': { text: 'नमस्ते। मेरा नाम ___ है।', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'कृपया। धन्यवाद। माफ़ कीजिए।', meaning: 'Please. Thank you. Excuse me.' },
  },
  bn: {
    'greetings-and-introductions': { text: 'নমস্কার। আমার নাম ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'দয়া করে। ধন্যবাদ। মাফ করবেন।', meaning: 'Please. Thank you. Excuse me.' },
  },
  te: {
    'greetings-and-introductions': { text: 'నమస్కారం. నా పేరు ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'దయచేసి. ధన్యవాదాలు. క్షమించండి.', meaning: 'Please. Thank you. Excuse me.' },
  },
  ml: {
    'greetings-and-introductions': { text: 'നമസ്കാരം. എന്റെ പേര് ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'ദയവായി. നന്ദി. ക്ഷമിക്കണം.', meaning: 'Please. Thank you. Excuse me.' },
  },
  kn: {
    'greetings-and-introductions': { text: 'ನಮಸ್ಕಾರ. ನನ್ನ ಹೆಸರು ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'ದಯವಿಟ್ಟು. ಧನ್ಯವಾದಗಳು. ಕ್ಷಮಿಸಿ.', meaning: 'Please. Thank you. Excuse me.' },
  },
  gu: {
    'greetings-and-introductions': { text: 'નમસ્તે. મારું નામ ___ છે.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'કૃપા કરીને. આભાર. માફ કરશો.', meaning: 'Please. Thank you. Excuse me.' },
  },
  mr: {
    'greetings-and-introductions': { text: 'नमस्कार. माझे नाव ___ आहे.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'कृपया. धन्यवाद. माफ करा.', meaning: 'Please. Thank you. Excuse me.' },
  },
  pa: {
    'greetings-and-introductions': { text: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਮੇਰਾ ਨਾਮ ___ ਹੈ।', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'ਕਿਰਪਾ ਕਰਕੇ। ਧੰਨਵਾਦ। ਮਾਫ਼ ਕਰਨਾ।', meaning: 'Please. Thank you. Excuse me.' },
  },
  ur: {
    'greetings-and-introductions': { text: 'السلام علیکم۔ میرا نام ___ ہے۔', meaning: 'Peace be upon you. My name is ___.' },
    'everyday-phrases': { text: 'براہ کرم۔ شکریہ۔ معاف کیجیے۔', meaning: 'Please. Thank you. Excuse me.' },
  },
  es: {
    'greetings-and-introductions': { text: 'Hola. Me llamo ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'Por favor. Gracias. Disculpe.', meaning: 'Please. Thank you. Excuse me.' },
  },
  fr: {
    'greetings-and-introductions': { text: 'Bonjour. Je m’appelle ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'S’il vous plaît. Merci. Excusez-moi.', meaning: 'Please. Thank you. Excuse me.' },
  },
  de: {
    'greetings-and-introductions': { text: 'Hallo. Ich heiße ___.', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'Bitte. Danke. Entschuldigung.', meaning: 'Please. Thank you. Excuse me.' },
  },
  ja: {
    'greetings-and-introductions': { text: 'こんにちは。わたしの名前は___です。', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: 'お願いします。ありがとう。すみません。', meaning: 'Please. Thank you. Excuse me.' },
  },
  zh: {
    'greetings-and-introductions': { text: '你好。我叫___。', meaning: 'Hello. My name is ___.' },
    'everyday-phrases': { text: '请。谢谢。不好意思。', meaning: 'Please. Thank you. Excuse me.' },
  },
}

/** One starter curriculum scaffold per catalogue language, with localized examples where available. */
export const LANGUAGE_LEARNING_STARTER_SEEDS: readonly LanguageStarterItem[] = LANGUAGE_DATABASE_SEEDS.flatMap((language) =>
  STARTER_UNITS.map((unit) => {
    const example = REVIEWED_EXAMPLES[language.id]?.[unit.unit]
    const reviewed = Boolean(example)
    return {
      id: `${language.id}:${unit.unit}:v1`,
      languageId: language.id,
      unit: unit.unit,
      title: unit.title,
      objective: unit.objective,
      activity: unit.activity,
      ...(example ? { sampleText: example.text, sampleMeaning: example.meaning } : {}),
      readiness: reviewed ? 'starter-reviewed' : 'scaffold-localization-needed',
      reviewRequired: !reviewed,
    }
  }),
)

export const LANGUAGE_SEED_SUMMARY = {
  languageCount: LANGUAGE_DATABASE_SEEDS.length,
  indiaConnectedCount: LANGUAGE_DATABASE_SEEDS.filter((language) => language.group === 'India').length,
  globalCount: LANGUAGE_DATABASE_SEEDS.filter((language) => language.group === 'Global').length,
  starterLessonCount: LANGUAGE_LEARNING_STARTER_SEEDS.length,
  languagesWithLocalizedExamples: Object.keys(REVIEWED_EXAMPLES).length,
} as const
