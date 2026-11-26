// Stable article IDs keep editorial relationships independent of title and slug changes.
import { readdirSync, readFileSync } from 'node:fs'

const topics = [
  { path: '/cakes/pave-chocolate-cake', label: 'Pavé Chocolate Cake', ids: ['draft-19', 'draft-09', 'draft-15', 'draft-18'] },
  { path: '/cakes/brownie-cheesecake', label: 'Brownie Basque Cheesecake', ids: ['draft-19', 'draft-18', 'draft-15', 'draft-09'] },
  { path: '/chocolates/chocolate-mochi', label: 'Chocolate Mochi', ids: ['draft-06', 'draft-16'] },
  { path: '/chocolates/almond-chocoball', label: 'Almond Chocolate', ids: ['draft-12', 'draft-01'] },
  { path: '/chocolates/pave-chocolate', label: 'Pavé Chocolate Heart Tin', ids: ['draft-20'] },
  { path: '/chocolates/eiffel-tower-chocolate', label: 'Eiffel Tower Chocolate', ids: ['draft-20'] },
  { path: '/celebrate', label: 'Small Bites', ids: ['draft-11', 'draft-14', 'draft-17'] },
  { path: '/cakes/smore-stick', label: 'S’more Sticks', ids: ['draft-17', 'draft-14'] },
]

export function publishedJournalEntries(source = new URL('../journal-source/', import.meta.url)) {
  return readdirSync(source, { withFileTypes: true }).filter(dir => dir.isDirectory())
    .map(dir => JSON.parse(readFileSync(new URL(dir.name + '/article.json', source), 'utf8')))
    .filter(entry => entry.status === 'published' && entry.publication?.approved === true)
}

export function storefrontReading(entries = publishedJournalEntries()) {
  return Object.fromEntries(topics.map(({ path, ids }) => [path, storyLinks(ids, entries)]))
}

function storyLinks(ids, entries) {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  return [...new Set(ids)].filter(id => byId.has(id)).map(id => {
    const entry = byId.get(id)
    return { href: '/journal/' + entry.slug, label: entry.title }
  })
}

export function journalReading(id, entries) {
  const matches = topics.filter(topic => topic.ids.includes(id))
  return [
    ...storyLinks(matches.flatMap(topic => topic.ids).filter(other => other !== id), entries).slice(0, 3),
    ...matches.map(topic => ({ href: topic.path, label: topic.label })),
  ]
}

export function readingHtml(heading, links, escape) {
  if (!links?.length) return ''
  return `<section class="au-related-reading"><h2>${escape(heading)}</h2><ul>${links.map(link => `<li><a href="${escape(link.href)}">${escape(link.label)}</a></li>`).join('')}</ul></section>`
}
