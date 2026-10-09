/**
 * VATTAMS Academia language discovery registry.
 * Catalogue presence does not mean the interface or every course is translated.
 */
export type LanguageGroup = 'India' | 'Global'
export interface AcademiaLanguage {
  id: string
  name: string
  nativeName: string
  group: LanguageGroup
}
const rows: Array<[string, string, string, LanguageGroup]> = [
  ['as','Assamese','অসমীয়া','India'],['bn','Bengali','বাংলা','India'],['brx','Bodo','बड़ो','India'],['doi','Dogri','डोगरी','India'],
  ['en-IN','English (India)','English','India'],['gu','Gujarati','ગુજરાતી','India'],['hi','Hindi','हिन्दी','India'],['kn','Kannada','ಕನ್ನಡ','India'],
  ['ks','Kashmiri','कॉशुर','India'],['kok','Konkani','कोंकणी','India'],['mai','Maithili','मैथिली','India'],['ml','Malayalam','മലയാളം','India'],
  ['mni','Meitei (Manipuri)','মৈতৈলোন্','India'],['mr','Marathi','मराठी','India'],['ne','Nepali','नेपाली','India'],['or','Odia','ଓଡ଼ିଆ','India'],
  ['pa','Punjabi','ਪੰਜਾਬੀ','India'],['sa','Sanskrit','संस्कृतम्','India'],['sat','Santali','ᱥᱟᱱᱛᱟᱲᱤ','India'],['sd','Sindhi','سنڌي','India'],
  ['ta','Tamil','தமிழ்','India'],['te','Telugu','తెలుగు','India'],['ur','Urdu','اردو','India'],['awa','Awadhi','अवधी','India'],
  ['bho','Bhojpuri','भोजपुरी','India'],['hne','Chhattisgarhi','छत्तीसगढ़ी','India'],['mag','Magahi','मगही','India'],['raj','Rajasthani','राजस्थानी','India'],
  ['tcy','Tulu','ತುಳು','India'],['lus','Mizo','Mizo ṭawng','India'],['kha','Khasi','Ka Ktien Khasi','India'],['grt','Garo','A·chik','India'],
  ['ar','Arabic','العربية','Global'],['hy','Armenian','Հայերեն','Global'],['az','Azerbaijani','Azərbaycanca','Global'],['eu','Basque','Euskara','Global'],
  ['be','Belarusian','Беларуская','Global'],['bg','Bulgarian','Български','Global'],['my','Burmese','မြန်မာ','Global'],['yue','Cantonese','粵語','Global'],
  ['ca','Catalan','Català','Global'],['zh','Chinese (Mandarin)','中文','Global'],['hr','Croatian','Hrvatski','Global'],['cs','Czech','Čeština','Global'],
  ['da','Danish','Dansk','Global'],['nl','Dutch','Nederlands','Global'],['fi','Finnish','Suomi','Global'],['fr','French','Français','Global'],
  ['de','German','Deutsch','Global'],['el','Greek','Ελληνικά','Global'],['ha','Hausa','Hausa','Global'],['he','Hebrew','עברית','Global'],
  ['hu','Hungarian','Magyar','Global'],['id','Indonesian','Bahasa Indonesia','Global'],['it','Italian','Italiano','Global'],['ja','Japanese','日本語','Global'],
  ['jv','Javanese','Basa Jawa','Global'],['km','Khmer','ខ្មែរ','Global'],['ko','Korean','한국어','Global'],['lo','Lao','ລາວ','Global'],
  ['ms','Malay','Bahasa Melayu','Global'],['mn','Mongolian','Монгол','Global'],['no','Norwegian','Norsk','Global'],['ps','Pashto','پښتو','Global'],
  ['fa','Persian (Farsi)','فارسی','Global'],['pl','Polish','Polski','Global'],['pt','Portuguese','Português','Global'],['ro','Romanian','Română','Global'],
  ['ru','Russian','Русский','Global'],['si','Sinhala','සිංහල','Global'],['es','Spanish','Español','Global'],['sw','Swahili','Kiswahili','Global'],
  ['sv','Swedish','Svenska','Global'],['tl','Tagalog / Filipino','Filipino','Global'],['th','Thai','ไทย','Global'],['tr','Turkish','Türkçe','Global'],
  ['uk','Ukrainian','Українська','Global'],['uz','Uzbek','Oʻzbekcha','Global'],['vi','Vietnamese','Tiếng Việt','Global'],['cy','Welsh','Cymraeg','Global'],
  ['yo','Yoruba','Èdè Yorùbá','Global'],['zu','Zulu','isiZulu','Global'],['am','Amharic','አማርኛ','Global'],['ak','Akan','Akan','Global'],
  ['ga','Irish','Gaeilge','Global'],['ka','Georgian','ქართული','Global'],['kk','Kazakh','Қазақша','Global'],['ky','Kyrgyz','Кыргызча','Global'],
  ['mg','Malagasy','Malagasy','Global'],['rw','Kinyarwanda','Ikinyarwanda','Global'],['ln','Lingala','Lingála','Global'],['xh','Xhosa','isiXhosa','Global'],
  ['sq','Albanian','Shqip','Global'],['et','Estonian','Eesti','Global'],['ku','Kurdish','Kurdî','Global'],['mi','Māori','Te Reo Māori','Global'],
  ['sm','Samoan','Gagana Samoa','Global'],['haw','Hawaiian','ʻŌlelo Hawaiʻi','Global'],['bo','Tibetan','བོད་སྐད་','Global'],['ht','Haitian Creole','Kreyòl ayisyen','Global'],
]
export const ACADEMIA_LANGUAGES: readonly AcademiaLanguage[] = rows
  .map(([id, name, nativeName, group]) => ({ id, name, nativeName, group }))
  .sort((a, b) => a.name.localeCompare(b.name))
export const ACADEMIA_LANGUAGE_GROUPS = ['All', 'India', 'Global'] as const
export type AcademiaLanguageGroupFilter = (typeof ACADEMIA_LANGUAGE_GROUPS)[number]
