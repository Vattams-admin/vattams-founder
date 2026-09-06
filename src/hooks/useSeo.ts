import { useEffect } from 'react'

// VATTAMS ACADEMIA — shared per-route SEO hook.
//
// No new dependency (no react-helmet): this just writes/updates the
// relevant <head> tags imperatively, the same way the rest of this app
// already talks to the DOM. Every public page calls this once with its
// own title/description; private/authenticated pages call it with
// `noindex: true` so they stay out of search results even though this
// is a client-rendered SPA and every route shares the same index.html.
//
// KNOWN LIMITATION: because there is no SSR/prerendering in this
// project (and this task does not add one), a crawler that does not
// execute JavaScript will only ever see the static tags already in
// index.html (which describe the Home page), not the per-route values
// this hook sets. Modern Googlebot does render JS for most crawls, but
// this is a real gap for crawlers that don't.

const SITE_NAME = 'VATTAMS ACADEMIA'
export const SITE_URL = 'https://academia.vattams.net'
const DEFAULT_OG_IMAGE = `${SITE_URL}/branding/logo.png`

export interface SeoOptions {
  /** Page title, without the site name — this hook appends " | VATTAMS ACADEMIA" (skipped if already present). Omit to just use the site name (e.g. for a private page with no useful title of its own). */
  title?: string
  description?: string
  /** Canonical path, e.g. "/courses/spoken-english". Defaults to the current location. Use this to point duplicate routes (like /verify) at their canonical counterpart. */
  path?: string
  /** Set true for authenticated/private pages so they are excluded from indexing. */
  noindex?: boolean
  type?: 'website' | 'article'
  image?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function setMetaByAttr(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLinkRel(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function useSeo(options: SeoOptions) {
  const {
    title,
    description,
    path,
    noindex = false,
    type = 'website',
    image = DEFAULT_OG_IMAGE,
    jsonLd,
  } = options

  useEffect(() => {
    const fullTitle = !title ? SITE_NAME : title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
    document.title = fullTitle

    const canonicalPath = path ?? window.location.pathname
    const canonicalUrl = `${SITE_URL}${canonicalPath}`

    if (description) {
      setMetaByAttr('name', 'description', description)
      setMetaByAttr('property', 'og:description', description)
      setMetaByAttr('name', 'twitter:description', description)
    }

    setMetaByAttr('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    setLinkRel('canonical', canonicalUrl)

    setMetaByAttr('property', 'og:title', fullTitle)
    setMetaByAttr('property', 'og:type', type)
    setMetaByAttr('property', 'og:url', canonicalUrl)
    setMetaByAttr('property', 'og:site_name', SITE_NAME)
    setMetaByAttr('property', 'og:image', image)

    setMetaByAttr('name', 'twitter:card', 'summary_large_image')
    setMetaByAttr('name', 'twitter:title', fullTitle)
    setMetaByAttr('name', 'twitter:image', image)

    let scriptEl: HTMLScriptElement | null = null
    if (jsonLd) {
      scriptEl = document.createElement('script')
      scriptEl.type = 'application/ld+json'
      scriptEl.text = JSON.stringify(jsonLd)
      scriptEl.dataset.seoJsonld = 'true'
      document.head.appendChild(scriptEl)
    }

    return () => {
      scriptEl?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, noindex, type, image, JSON.stringify(jsonLd)])
}
