import { ZoomIn } from 'lucide-react'
import { useRef, useState } from 'react'

const posters = [
  { id: 'mochi', en: 'Pavé Chocolate Mochi', ko: '파베 초콜릿 모찌', x: 364, y: 65 },
  { id: 'gateau', en: 'Gâteau au Chocolat', ko: '갸또 오 쇼콜라', x: 728, y: 65 },
  { id: 'basque', en: 'Brownie Basque Whole Cake', ko: '브라우니 바스크 홀케이크', x: 541, y: 368 },
  { id: 'pave', en: 'Pavé Chocolate Cake', ko: '파베 초콜릿 케이크', x: 910, y: 369 },
] as const

export function PosterWall({ ko }: { ko: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, select] = useState<(typeof posters)[number]>()
  const title = selected?.[ko ? 'ko' : 'en']
  return <section id="poster-wall" className="au-poster-wall" aria-label={ko ? '제품 포스터' : 'Product posters'}>
    <img className="au-poster-banner" src="/home/poster-wall-wide.webp"
      srcSet="/home/poster-wall-mobile.webp 800w, /home/poster-wall-wide.webp 1448w"
      sizes="(max-width: 1200px) 100vw, 1200px" width={1448} height={762} loading="lazy"
      alt={ko ? '벽돌 벽에 붙은 베리굿 겨울 포스터' : 'Verygood winter posters on a brick wall'} />
    {posters.map(poster => <button key={poster.id} type="button" className="au-poster-hotspot"
      style={{ left: poster.x / 1448 * 100 + '%', top: poster.y / 762 * 100 + '%' }}
      aria-haspopup="dialog" aria-label={ko ? poster.ko + ' 포스터 확대' : 'Enlarge ' + poster.en + ' poster'}
      onClick={() => { select(poster); dialog.current?.showModal() }}>
      <span className="au-poster-hint" aria-hidden="true">
        <span>{ko ? '포스터 보기' : 'View poster'}</span>
        <ZoomIn size={15} />
      </span>
    </button>)}
    <dialog ref={dialog} className="au-poster-dialog" aria-label={title} onClose={() => select(undefined)}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      {selected && <img src={'/home/posters/' + selected.id + '.webp'} alt={title} />}
      <button type="button" aria-label={ko ? '포스터 닫기' : 'Close poster'} onClick={() => dialog.current?.close()}>×</button>
    </dialog>
  </section>
}
