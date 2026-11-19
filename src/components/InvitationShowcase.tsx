import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Pause, Play } from 'lucide-react'

const samples = [
  ['orange-cheers', 'Orange Cheers', 'custom'],
  ['study-doodle-birthday', 'Doodle Birthday', 'editable'],
  ['chocolate-collage', 'Chocolate Collage', 'custom'],
  ['study-ribbon-party', 'Ribbon Party', 'editable'],
  ['vintage-cake-party', 'Vintage Cake Party', 'custom'],
  ['study-soft-celebration', 'Soft Celebration', 'editable'],
] as const
const origin = 'https://invite.verygood-chocolate.com'

export function InvitationShowcase({ ko }: { ko: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const resumeAfter = useRef(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const el = track.current
    if (!el || paused || reduced) return
    let frame = 0
    let previous = 0
    let fraction = 0
    const tick = (now: number) => {
      if (previous && now >= resumeAfter.current && !el.querySelector(':focus-visible')) {
        fraction += Math.min(now - previous, 64) * 0.026
        const step = Math.floor(fraction)
        fraction -= step
        const cycle = el.children[samples.length] as HTMLElement
        const length = cycle.offsetLeft - (el.firstElementChild as HTMLElement).offsetLeft
        if (length) el.scrollLeft = (el.scrollLeft + step) % length
      }
      previous = now
      frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame)
      previous = 0
      if (entry.isIntersecting) frame = requestAnimationFrame(tick)
    })
    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [paused, reduced])

  return <section id="invitations" className="au-v02-invitations" aria-labelledby="au-invitations-title">
    <header>
      <h2 id="au-invitations-title">{ko ? '손님을 초대하세요' : 'Invite your guests'}</h2>
      <a className="au-v02-button au-v02-button-outline" href={origin + '/'} target="_blank" rel="noopener noreferrer">
        {ko ? '무료 초대장 만들기' : 'Make a free invitation'} <ArrowUpRight size={15} aria-hidden="true" />
      </a>
      {!reduced && <button type="button" onClick={() => setPaused(!paused)}
        aria-label={paused ? (ko ? '카드 재생' : 'Play slideshow') : (ko ? '카드 일시정지' : 'Pause slideshow')}>
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>}
    </header>
    <div className="au-invite-track" ref={track}
      onTouchStart={() => { resumeAfter.current = Infinity }}
      onTouchEnd={() => { resumeAfter.current = performance.now() + 900 }}
      onTouchCancel={() => { resumeAfter.current = performance.now() + 900 }}
      onWheel={event => {
        if (event.deltaX || event.shiftKey) resumeAfter.current = performance.now() + 900
      }}>
      {(reduced ? [false] : [false, true]).map(copy => samples.map(([slug, name, kind]) =>
        <a key={slug + copy} href={origin + '/gallery/' + slug} target="_blank" rel="noopener noreferrer"
          aria-hidden={copy || undefined} tabIndex={copy ? -1 : undefined} data-kind={kind}>
          <img src={'/home/invitations/' + slug + '.webp'} alt="" loading="lazy" />
          <small>{kind === 'editable' ? (ko ? '편집 가능한 템플릿' : 'Editable template') : (ko ? '커스텀 디자인 예시' : 'Custom design study')}</small>
          <strong>{name} ↗</strong>
        </a>))}
    </div>
  </section>
}
