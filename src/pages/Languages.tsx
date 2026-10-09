import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACADEMIA_LANGUAGES, ACADEMIA_LANGUAGE_GROUPS, type AcademiaLanguageGroupFilter } from '@/lib/globalLanguages'
import { LANGUAGE_LEARNING_STARTER_SEEDS, LANGUAGE_SEED_SUMMARY } from '@/lib/languageLearningSeeds'
import { useSeo } from '@/hooks/useSeo'

export default function Languages() {
  useSeo('Languages | VATTAMS Academia', 'Explore the Indian-connected and global language catalogue planned for VATTAMS Academia.')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<AcademiaLanguageGroupFilter>('All')
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return ACADEMIA_LANGUAGES.filter((language) =>
      (group === 'All' || language.group === group) &&
      (!term || language.name.toLocaleLowerCase().includes(term) ||
        language.nativeName.toLocaleLowerCase().includes(term) || language.id.toLocaleLowerCase() === term)
    )
  }, [search, group])
  const indiaCount = ACADEMIA_LANGUAGES.filter((language) => language.group === 'India').length
  const globalCount = ACADEMIA_LANGUAGES.filter((language) => language.group === 'Global').length

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link to="/" className="text-sm text-gold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">← Home</Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-gold">VATTAMS Academia · Language catalogue</p>
        <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">India-connected & global languages</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-muted">
          A discovery catalogue for future language courses and multilingual learning journeys—from Indian languages and regional varieties to languages used around the world.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-4"><p className="text-sm text-slate-muted">India-connected catalogue</p><p className="mt-1 text-2xl font-semibold">{indiaCount} languages</p></div>
        <div className="card p-4"><p className="text-sm text-slate-muted">Global catalogue</p><p className="mt-1 text-2xl font-semibold">{globalCount} languages</p></div>
        <div className="card p-4"><p className="text-sm text-slate-muted">Beginner starter curriculum</p><p className="mt-1 text-2xl font-semibold">{LANGUAGE_SEED_SUMMARY.starterLessonCount} lesson seeds</p><p className="mt-1 text-xs text-slate-muted">{LANGUAGE_LEARNING_STARTER_SEEDS.filter((item) => !item.reviewRequired).length} lesson seeds include localized examples</p><p className="mt-1 text-xs text-slate-muted">{LANGUAGE_LEARNING_STARTER_SEEDS.filter((item) => item.reviewRequired).length} lesson seeds need localization or review</p></div>
      </div>

      <section className="card p-4 sm:p-6" aria-label="Browse language catalogue">
        <label htmlFor="language-search" className="mb-2 block text-sm font-medium">Search by language or native name</label>
        <input id="language-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try Tamil, தமிழ், Spanish…" className="w-full rounded-card border border-white/15 bg-white/5 px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Language group">
          {ACADEMIA_LANGUAGE_GROUPS.map((item) => (
            <button key={item} type="button" onClick={() => setGroup(item)} aria-pressed={group === item} className={`rounded-full border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${group === item ? 'border-gold/50 bg-gold/15 text-gold-bright' : 'border-white/10 text-slate-muted hover:bg-white/5'}`}>
              {item === 'All' ? 'All languages' : item === 'India' ? 'India-connected' : 'Global languages'}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-muted" aria-live="polite" aria-atomic="true">Showing {filtered.length} of {ACADEMIA_LANGUAGES.length} catalogue entries</p>
        {filtered.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((language) => (
              <li key={language.id} className="rounded-card border border-white/10 p-4">
                <p className="font-semibold">{language.name}</p>
                <p className="mt-1 text-lg text-gold-bright" lang={language.id}>{language.nativeName}</p>
                <p className="mt-2 text-xs text-slate-muted">{language.group === 'India' ? 'India-connected' : 'Global'} · {language.id}</p>
                <p className="mt-2 text-xs text-slate-muted">5 beginner lesson seeds</p>
                <p className="mt-1 text-xs font-medium text-gold-bright">{LANGUAGE_LEARNING_STARTER_SEEDS.some((item) => item.languageId === language.id && !item.reviewRequired) ? 'Some localized examples included' : 'Localization review needed'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-card border border-white/10 p-5 text-sm text-slate-muted" role="status">
            No languages match this search. Try another name or choose a different group.
            <button type="button" onClick={() => { setSearch(''); setGroup('All') }} className="ml-2 text-gold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">Clear filters</button>
          </div>
        )}
      </section>

      <p className="mt-5 text-xs leading-5 text-slate-muted">
        Important: catalogue inclusion records intended coverage; it does not claim that the platform interface or every course has already been translated. Each language still needs reviewed learning content, fonts/script checks, and quality assurance before being marked production-ready.
      </p>
    </main>
  )
}
