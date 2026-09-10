import { useEffect, useState } from 'react'
import { getCakeWireRepository } from '../lib/custom-cake-repository'
import type { PhotoReadResponse } from '../lib/custom-cake-photo-contract'

export function CustomCakePhoto({ requestNumber, photoRef, customerPhone }: {
  requestNumber: string
  photoRef: string
  /** Omitted only inside the already authenticated admin view. */
  customerPhone?: string
}) {
  const [photo, setPhoto] = useState<PhotoReadResponse | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let active = true
    getCakeWireRepository().then(repo => repo.readPhoto({
      contractVersion: 'custom-cake-photo.v1', requestNumber, photoRef,
      authorization: customerPhone === undefined ? { kind: 'admin' } : { kind: 'customer', customerPhone },
    })).then(result => { if (active) setPhoto(result) })
      .catch(() => { if (active) setUnavailable(true) })
    return () => { active = false }
  }, [requestNumber, photoRef, customerPhone])
  if (unavailable) return <span className="photo-ref-badge">Photo unavailable</span>
  if (!photo) return <span className="photo-ref-badge">Loading photo…</span>
  return <div className="custom-cake-photo-thumb">
    <img src={`data:${photo.mimeType};base64,${photo.base64}`} alt="Cake design reference" width={80} height={80} />
  </div>
}
