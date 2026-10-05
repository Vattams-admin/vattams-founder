#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

const index = read('index.html')
const robots = read('public/robots.txt')
const sitemap = read('public/sitemap.xml')
const app = read('src/App.tsx')
const seo = read('src/hooks/useSeo.ts')
const generator = read('scripts/generate-sitemap.mjs')

const failures = []

function requireText(label, source, pattern) {
  if (!source.includes(pattern)) failures.push(label)
}

requireText('homepage title', index, '<title>VATTAMS ACADEMIA — Courses, Exams &amp; Competitions</title>')
requireText('homepage description', index, 'name="description"')
requireText('homepage canonical', index, 'href="https://academia.vattams.net/"')
requireText('homepage robots', index, 'name="robots" content="index, follow"')
requireText('homepage OG image', index, 'property="og:image"')
requireText('homepage Twitter card', index, 'name="twitter:card"')
requireText('robots sitemap', robots, 'Sitemap: https://academia.vattams.net/sitemap.xml')
requireText('robots private payment', robots, 'Disallow: /pay/')
requireText('robots admin', robots, 'Disallow: /admin')
requireText('competitive exam route', app, 'path="/competitive-exams"')
requireText('SEO canonical normalization', seo, 'replace(/\\/+$/, \'\')')
requireText('sitemap competitive exams', generator, "{ path: '/competitive-exams'")
requireText('sitemap excludes registrations', generator, "{ path: '/student/register'")
requireText('sitemap includes published competitions', generator, 'course.slug')

if (/<loc>https:\/\/academia\.vattams\.net\/(login|dashboard|pay\/|admin|learn\/|student\/register|tutor\/register)/.test(sitemap)) {
  failures.push('private URL present in sitemap.xml')
}

const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])
if (new Set(locs).size !== locs.length) failures.push('duplicate URL in sitemap.xml')
if (!locs.includes('https://academia.vattams.net/competitive-exams')) failures.push('competitive-exams missing from sitemap.xml')

if (failures.length) {
  console.error('SEO VALIDATION FAILED')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`SEO VALIDATION PASS — ${locs.length} sitemap URLs, canonical/robots/social metadata present, private URLs excluded`)
