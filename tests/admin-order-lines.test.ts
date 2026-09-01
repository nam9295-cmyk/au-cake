import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeCakeCalendarEvent } from '../appwrite-functions/reservation-api/src/calendar-access.js'
import { parseStoredOrderLines } from '../appwrite-functions/reservation-api/src/business.js'
import { createReservation, getReservationByNumber, listReservations, toReservation, toReservationList, updateReservation } from '../src/lib/repository.js'

const lines = [
  {
    productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1,
    unitPriceCents: 7500, subtotalCents: 7500, discountPercent: 0, discountCents: 0, totalPriceCents: 7500,
  },
  {
    productId: 'choco-basque-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1,
    unitPriceCents: 5500, subtotalCents: 5500, discountPercent: 0, discountCents: 0, totalPriceCents: 5500,
  },
]

const document = {
  $id: 'reservation-1', reservationNumber: 'VG-20990711-0001', customerName: 'Customer', customerPhone: '0412345678',
  productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', chocolateIcingCount: 0,
  vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', quantity: 1,
  pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '100', requestNote: '', status: '예약신청',
  paymentStatus: '입금대기', totalPrice: 130, totalPriceCents: 13000, subtotalCents: 13000,
  discountBasisCents: 0, discountPercent: 0, discountCents: 0, adminMemo: '', createdAt: '2099-07-01T00:00:00.000Z',
  updatedAt: '2099-07-01T00:00:00.000Z', orderLinesJson: JSON.stringify({ version: 1, lines }),
  orderLineCount: 2, orderItemCount: 2,
}

test('admin Appwrite hydration preserves every validated stored order line and aggregate', () => {
  const reservation = toReservation(document as never)
  assert.equal(reservation.orderLines?.length, 2)
  assert.deepEqual(reservation.orderLines?.map((line) => line.productId), ['pave-cake', 'choco-basque-cheesecake'])
  assert.equal(reservation.orderLineCount, 2)
  assert.equal(reservation.orderItemCount, 2)
  assert.equal(reservation.totalPriceCents, 13000)
  assert.equal(reservation.totalPrice, 130)
})

test('admin retains the historical whole-cake order accepted by the read-only calendar', () => {
  const historicalLines = [
    {
      ...lines[0],
      unitPriceCents: 7900,
      subtotalCents: 7900,
      totalPriceCents: 7900,
    },
    {
      ...lines[0],
      cakeSize: '19cm',
      unitPriceCents: 9900,
      subtotalCents: 9900,
      totalPriceCents: 9900,
    },
  ]
  const storedReservation = {
    ...document,
    $id: 'historical-whole-cake-id',
    unitPrice: 7900,
    totalPrice: 178,
    subtotalCents: 17800,
    totalPriceCents: 17800,
    orderLinesJson: JSON.stringify({ version: 1, lines: historicalLines }),
  }

  const calendarEvent = sanitizeCakeCalendarEvent(storedReservation)
  const reservations = toReservationList([storedReservation] as never)

  assert.equal(calendarEvent.label, 'Pave cake · 6" | serves 8 · Dark chocolate ×1 / Pave cake · 7.5" | serves 14 · Dark chocolate ×1')
  assert.equal(reservations.length, 1)
  assert.deepEqual(reservations[0].orderLines?.map((line) => [line.cakeSize, line.unitPriceCents]), [
    ['15cm', 7900],
    ['19cm', 9900],
  ])
})

test('admin preserves the stored Pave milk option accepted by the server parser', () => {
  const line = {
    ...lines[0],
    chocolateType: 'milk',
  }
  const storedReservation = {
    ...document,
    $id: 'historical-pave-milk-id',
    chocolateType: 'milk',
    cupcakeFinish: null,
    totalPrice: 75,
    subtotalCents: 7500,
    totalPriceCents: 7500,
    orderLinesJson: JSON.stringify({ version: 1, lines: [line] }),
    orderLineCount: 1,
    orderItemCount: 1,
  }

  assert.equal(parseStoredOrderLines(storedReservation).lines[0].chocolateType, 'milk')
  assert.equal(toReservation(storedReservation as never).orderLines?.[0]?.chocolateType, 'milk')
})

test('admin rejects the same unsupported size and fallback-price pairs as the server parser', () => {
  for (const [productId, cakeSize, unitPriceCents] of [
    ['pave-cake', '19cm', 7900],
    ['pave-cake', '22cm', 7900],
    ['buttercream-cake', '19cm', 7500],
    ['buttercream-cake', '22cm', 7500],
    ['fresh-strawberry-vanilla-cream-cake', '15cm', 6500],
    ['fresh-strawberry-chocolate-cream-cake', '15cm', 6900],
  ] as const) {
    const usesButtercreamOptions = productId === 'buttercream-cake'
    const line = {
      ...lines[0],
      productId,
      cakeSize,
      vanillaCakeSheet: usesButtercreamOptions ? 'chocolate' : 'vanilla',
      vanillaCakeFlavor: usesButtercreamOptions ? 'plain' : 'triple-berry',
      unitPriceCents,
      subtotalCents: unitPriceCents,
      totalPriceCents: unitPriceCents,
    }
    const forgedReservation = {
      ...document,
      productId,
      cakeSize,
      vanillaCakeSheet: line.vanillaCakeSheet,
      vanillaCakeFlavor: line.vanillaCakeFlavor,
      totalPrice: unitPriceCents / 100,
      subtotalCents: unitPriceCents,
      totalPriceCents: unitPriceCents,
      orderLinesJson: JSON.stringify({ version: 1, lines: [line] }),
      orderLineCount: 1,
      orderItemCount: 1,
    }

    assert.throws(() => parseStoredOrderLines(forgedReservation), /INVALID_(?:CAKE_SIZE|STORED_ORDER)/)
    assert.throws(() => toReservation(forgedReservation as never), /INVALID_STORED_ORDER/)
  }
})

test('admin Appwrite hydration retains a current Strawberry Whole Cake line with its inch key', () => {
  const line = {
    productId: 'fresh-strawberry-vanilla-cream-cake', cakeSize: '8in', chocolateType: 'dark', poundAddon: 'none',
    chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink', quantity: 1,
    unitPriceCents: 8900, subtotalCents: 8900, discountPercent: 0, discountCents: 0, totalPriceCents: 8900,
  }
  const reservation = toReservation({
    ...document,
    productId: line.productId, cakeSize: line.cakeSize, chocolateType: line.chocolateType, poundAddon: line.poundAddon,
    chocolateIcingCount: line.chocolateIcingCount, vanillaCreamCount: line.vanillaCreamCount, partyDecorationCount: line.partyDecorationCount,
    vanillaCakeSheet: line.vanillaCakeSheet, vanillaCakeFlavor: line.vanillaCakeFlavor, quantity: 1,
    totalPrice: 89, totalPriceCents: 8900, subtotalCents: 8900, discountBasisCents: 0, discountPercent: 0, discountCents: 0,
    orderLinesJson: JSON.stringify({ version: 1, lines: [line] }), orderLineCount: 1, orderItemCount: 1,
  } as never)
  assert.equal(reservation.productId, 'fresh-strawberry-vanilla-cream-cake')
  assert.equal(reservation.cakeSize, '8in')
  assert.equal(reservation.orderLines?.[0]?.unitPriceCents, 8900)
})

test('admin Appwrite hydration retains a selected Chocolate Extra without repricing the cake unit', () => {
  const line = {
    productId: 'pave-cake', cakeSize: '6in', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic',
    chocolateIcingCount: 0, chocolateExtra: 'combo', chocolateExtraCents: 2000,
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink',
    quantity: 2, unitPriceCents: 7900, subtotalCents: 17800, discountPercent: 0, discountCents: 0, totalPriceCents: 17800,
  }
  const reservation = toReservation({
    ...document,
    $id: 'reservation-chocolate-extra', productId: line.productId, cakeSize: line.cakeSize, chocolateType: line.chocolateType,
    poundAddon: line.poundAddon, cupcakeFinish: line.cupcakeFinish, quantity: line.quantity,
    totalPrice: 178, totalPriceCents: 17800, subtotalCents: 17800, discountBasisCents: 0, discountPercent: 0, discountCents: 0,
    orderLinesJson: JSON.stringify({ version: 1, lines: [line] }), orderLineCount: 1, orderItemCount: 2,
  } as never)

  assert.equal(reservation.chocolateExtra, 'combo')
  assert.deepEqual(
    [reservation.orderLines?.[0]?.chocolateExtra, reservation.orderLines?.[0]?.chocolateExtraCents, reservation.orderLines?.[0]?.unitPriceCents, reservation.orderLines?.[0]?.totalPriceCents],
    ['combo', 2000, 7900, 17800],
  )
})

test('admin Appwrite hydration retains Brownie Fresh cream as a distinct priced order-line option', () => {
  const line = {
    productId: 'brownie-cheesecake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none', cupcakeFinish: 'basic',
    chocolateIcingCount: 0, chocolateExtra: 'none', chocolateExtraCents: 0, brownieCreamOption: 'fresh-cream',
    vanillaCreamCount: 0, partyDecorationCount: 0, vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink',
    quantity: 1, unitPriceCents: 10500, subtotalCents: 10500, discountPercent: 0, discountCents: 0, totalPriceCents: 10500,
  }
  const reservation = toReservation({
    ...document,
    $id: 'reservation-brownie-cream', productId: line.productId, cakeSize: line.cakeSize, cupcakeFinish: line.cupcakeFinish,
    totalPrice: 105, totalPriceCents: 10500, subtotalCents: 10500, discountBasisCents: 0, discountPercent: 0, discountCents: 0,
    orderLinesJson: JSON.stringify({ version: 1, lines: [line] }), orderLineCount: 1, orderItemCount: 1,
  } as never)

  assert.equal(reservation.orderLines?.[0]?.brownieCreamOption, 'fresh-cream')
  assert.equal(reservation.orderLines?.[0]?.unitPriceCents, 10500)
})

test('admin Appwrite hydration retains current Pave and Buttercream inch pricing', () => {
  for (const [productId, cakeSize, unitPriceCents] of [
    ['pave-cake', '8in', 10900],
    ['buttercream-cake', '10in', 14500],
  ] as const) {
    const line = {
      productId, cakeSize, chocolateType: 'dark', poundAddon: 'none',
      chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
      vanillaCakeSheet: productId === 'buttercream-cake' ? 'chocolate' : 'vanilla',
      vanillaCakeFlavor: productId === 'buttercream-cake' ? 'plain' : 'triple-berry',
      vanillaCakePointColor: 'pink', quantity: 1,
      unitPriceCents, subtotalCents: unitPriceCents, discountPercent: 0, discountCents: 0, totalPriceCents: unitPriceCents,
    }
    const reservation = toReservation({
      ...document,
      productId, cakeSize, chocolateType: line.chocolateType, poundAddon: line.poundAddon,
      chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
      vanillaCakeSheet: line.vanillaCakeSheet, vanillaCakeFlavor: line.vanillaCakeFlavor, quantity: 1,
      totalPrice: unitPriceCents / 100, totalPriceCents: unitPriceCents, subtotalCents: unitPriceCents,
      discountBasisCents: 0, discountPercent: 0, discountCents: 0,
      orderLinesJson: JSON.stringify({ version: 1, lines: [line] }), orderLineCount: 1, orderItemCount: 1,
    } as never)
    assert.equal(reservation.cakeSize, cakeSize)
    assert.equal(reservation.orderLines?.[0]?.unitPriceCents, unitPriceCents)
  }
})

test('admin hydration safely represents historical cake reservations without customer email', async () => {
  const reservation = toReservation(document as never)
  assert.equal(reservation.customerEmail, '')
  assert.equal(toReservationList([document as never])[0]?.customerEmail, '')

  await withLocalReservations([reservation], async () => {
    const rows = await listReservations({
      pickupDate: '', status: '', paymentStatus: '', cacaoPercent: '', search: reservation.reservationNumber,
    })
    assert.equal(rows[0]?.customerEmail, '')
  })
})

test('admin local search includes normalized customer email', async () => {
  const reservation = toReservation({ ...document, customerEmail: ' Customer@Example.COM ' } as never)
  await withLocalReservations([reservation], async () => {
    const rows = await listReservations({
      pickupDate: '', status: '', paymentStatus: '', cacaoPercent: '', search: 'CUSTOMER@EXAMPLE.COM',
    })
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.customerEmail, 'customer@example.com')
  })
})

test('admin Appwrite hydration keeps only approved pre-price-update product prices readable in admin and public lookup', async () => {
  const historicalPrices = [
    ['pave-cake', '15cm', 7500], ['pave-cake', '19cm', 9500], ['pave-cake', '22cm', 11500],
    ['pave-cake', '15cm', 7900], ['pave-cake', '19cm', 9900], ['pave-cake', '22cm', 13700],
    ['vanilla-fresh-cream-cake', '15cm', 7500], ['vanilla-fresh-cream-cake', '19cm', 9800], ['vanilla-fresh-cream-cake', '22cm', 13900],
    ['buttercream-cake', '15cm', 7500], ['buttercream-cake', '19cm', 9800], ['buttercream-cake', '22cm', 13900],
    ['buttercream-cake', '15cm', 7400], ['buttercream-cake', '19cm', 9400], ['buttercream-cake', '22cm', 12800],
    ['brownie-cheesecake', '15cm', 5800], ['pave-brownie-cheesecake', '15cm', 6800],
  ] as const

  for (const [productId, cakeSize, unitPriceCents] of historicalPrices) {
    const historicalLine = {
      ...lines[0], productId, cakeSize,
      vanillaCakeSheet: productId === 'vanilla-fresh-cream-cake' ? 'chocolate' : 'vanilla',
      unitPriceCents, subtotalCents: unitPriceCents, totalPriceCents: unitPriceCents,
    }
    const historicalDocument = {
      ...document,
      productId,
      cakeSize,
      vanillaCakeSheet: historicalLine.vanillaCakeSheet,
      quantity: 1,
      totalPrice: unitPriceCents / 100,
      totalPriceCents: unitPriceCents,
      subtotalCents: unitPriceCents,
      discountBasisCents: 0,
      discountPercent: 0,
      discountCents: 0,
      orderLinesJson: JSON.stringify({ version: 1, lines: [historicalLine] }),
      orderLineCount: 1,
      orderItemCount: 1,
    }
    const reservation = toReservation(historicalDocument as never)
    assert.equal(reservation.orderLines?.[0]?.unitPriceCents, unitPriceCents)
    await withLocalReservations([reservation], async () => {
      const publicReservation = await getReservationByNumber(reservation.reservationNumber, reservation.customerPhone)
      assert.equal(publicReservation?.orderLines?.[0]?.unitPriceCents, unitPriceCents)
    })
  }



  for (const brownieCreamOption of ['none', 'fresh-cream'] as const) {
    const underpricedLine = {
      ...lines[0],
      productId: 'brownie-cheesecake',
      brownieCreamOption,
      unitPriceCents: 5800,
      subtotalCents: 5800,
      totalPriceCents: 5800,
    }
    const underpricedDocument = {
      ...document,
      productId: 'brownie-cheesecake',
      totalPrice: 58,
      totalPriceCents: 5800,
      subtotalCents: 5800,
      orderLinesJson: JSON.stringify({ version: 1, lines: [underpricedLine] }),
      orderLineCount: 1,
      orderItemCount: 1,
    }
    assert.throws(() => toReservation(underpricedDocument as never), /INVALID_STORED_ORDER/)
    await withLocalReservations([{
      ...underpricedDocument,
      id: underpricedDocument.$id,
      orderLines: [underpricedLine],
    } as never], async () => {
      await assert.rejects(
        () => getReservationByNumber(underpricedDocument.reservationNumber, underpricedDocument.customerPhone),
        /INVALID_RESERVATION_RESPONSE/,
      )
    })
  }

  const forgedLine = { ...lines[0], unitPriceCents: 7800, subtotalCents: 7800, totalPriceCents: 7800 }
  assert.throws(() => toReservation({
    ...document,
    totalPrice: 78,
    totalPriceCents: 7800,
    subtotalCents: 7800,
    orderLinesJson: JSON.stringify({ version: 1, lines: [forgedLine] }),
    orderLineCount: 1,
    orderItemCount: 1,
  } as never), /INVALID_STORED_ORDER/)
})

test('admin Appwrite hydration retains mixed cupcake finishes with the same pack product', () => {
  const mixedFinishLines = [
    {
      productId: 'cupcake-half-dozen', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
      cupcakeFinish: 'chocolate-buttercream', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
      vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink', quantity: 1,
      unitPriceCents: 4100, subtotalCents: 4100, discountPercent: 0, discountCents: 0, totalPriceCents: 4100,
    },
    {
      productId: 'cupcake-half-dozen', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
      cupcakeFinish: 'vanilla-fresh-cream', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
      vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink', quantity: 1,
      unitPriceCents: 3600, subtotalCents: 3600, discountPercent: 0, discountCents: 0, totalPriceCents: 3600,
    },
  ]
  const mixedFinishDocument = {
    ...document,
    $id: 'reservation-mixed-cupcakes',
    reservationNumber: 'VG-C-AU-20260822-160000001',
    productId: 'cupcake-half-dozen',
    cupcakeFinish: 'chocolate-buttercream',
    pickupDate: '2026-08-22',
    pickupTime: '16:00',
    totalPrice: 77,
    totalPriceCents: 7700,
    subtotalCents: 7700,
    discountBasisCents: 0,
    discountPercent: 0,
    discountCents: 0,
    orderLinesJson: JSON.stringify({ version: 1, lines: mixedFinishLines }),
    orderLineCount: 2,
    orderItemCount: 2,
  }

  const reservations = toReservationList([mixedFinishDocument] as never)

  assert.equal(reservations.length, 1)
  assert.deepEqual(reservations[0].orderLines?.map((line) => [line.productId, line.cupcakeFinish, line.totalPriceCents]), [
    ['cupcake-half-dozen', 'chocolate-buttercream', 4100],
    ['cupcake-half-dozen', 'vanilla-fresh-cream', 3600],
  ])
})

test('admin Appwrite hydration preserves authoritative individual packaging fields', () => {
  const packagedLine = {
    productId: 'cupcake-half-dozen', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
    cupcakeFinish: 'basic', chocolateIcingCount: 0, vanillaCreamCount: 0, partyDecorationCount: 0,
    vanillaCakeSheet: 'vanilla', vanillaCakeFlavor: 'triple-berry', vanillaCakePointColor: 'pink', quantity: 1,
    unitPriceCents: 3100, subtotalCents: 3100, individualPackaging: true,
    discountPercent: 0, discountCents: 0, individualPackagingPieces: 6,
    individualPackagingFeeCents: 300, totalPriceCents: 3400,
  }
  const reservation = toReservation({
    ...document,
    $id: 'reservation-packaged-cupcakes',
    productId: 'cupcake-half-dozen',
    cupcakeFinish: 'basic',
    totalPrice: 34,
    totalPriceCents: 3400,
    subtotalCents: 3100,
    individualPackagingPieces: 6,
    individualPackagingFeeCents: 300,
    orderLinesJson: JSON.stringify({ version: 1, lines: [packagedLine] }),
    orderLineCount: 1,
    orderItemCount: 1,
  } as never)

  assert.equal(reservation.individualPackaging, true)
  assert.equal(reservation.individualPackagingPieces, 6)
  assert.equal(reservation.individualPackagingFeeCents, 300)
  assert.equal(reservation.orderLines?.[0]?.individualPackaging, true)
  assert.equal(reservation.orderLines?.[0]?.totalPriceCents, 3400)
})

test('admin Appwrite hydration treats nullable unused discount fields as absent', () => {
  const reservation = toReservation({
    ...document,
    appliedPromoCodeLast4: null,
    reviewCouponId: null,
  } as never)

  assert.equal(reservation.orderLines?.length, 2)
  assert.equal(reservation.discountPercent, 0)
  assert.equal(reservation.totalPriceCents, 13000)
})

test('admin treats a nullable top-level Cupcake finish as absent for older stored orders', () => {
  const reservation = toReservation({ ...document, cupcakeFinish: null } as never)

  assert.equal(Object.hasOwn(reservation, 'cupcakeFinish'), false)
  assert.equal(reservation.orderLines?.length, 2)
})

test('admin reservation list isolates a malformed historical order instead of hiding valid bookings', () => {
  const validLatest = {
    ...document,
    $id: 'reservation-latest',
    reservationNumber: 'VG-C-AU-20260813-154142875',
    pickupDate: '2026-08-15',
  }
  const malformedHistorical = {
    ...document,
    $id: 'reservation-malformed',
    reservationNumber: 'VG-C-AU-20260805-235053264',
    orderLinesJson: '{',
  }

  const reservations = toReservationList([validLatest, malformedHistorical] as never)

  assert.deepEqual(reservations.map((reservation) => reservation.reservationNumber), [validLatest.reservationNumber])
})

test('admin Appwrite hydration fails closed when present stored order data is malformed or inconsistent', () => {
  const forgedDiscountLines = [
    { ...lines[0], discountPercent: 10, discountCents: 1, totalPriceCents: 7499 },
    lines[1],
  ]
  for (const invalid of [
    { orderLinesJson: '{' },
    { orderLinesJson: JSON.stringify({ version: 2, lines }) },
    { orderLinesJson: JSON.stringify({ version: 1, lines: [{ ...lines[0], privateField: true }, lines[1]] }) },
    { orderLineCount: 1 },
    { totalPriceCents: 12999 },
    { productId: 'pound-cake' },
    { orderLinesJson: `${document.orderLinesJson}${' '.repeat(65_536)}` },
    {
      orderLinesJson: JSON.stringify({ version: 1, lines: forgedDiscountLines }),
      discountBasisCents: 1,
      discountPercent: 10,
      discountCents: 1,
      totalPriceCents: 12999,
      totalPrice: 129.99,
    },
  ]) assert.throws(() => toReservation({ ...document, ...invalid } as never), /INVALID_STORED_ORDER/)
})

test('admin Appwrite hydration preserves the legacy single-line fallback when stored JSON is absent or nullable', () => {
  const absent: Record<string, unknown> = { ...document }
  delete absent.orderLinesJson
  delete absent.orderLineCount
  delete absent.orderItemCount
  delete absent.discountBasisCents

  const nullable = {
    ...absent,
    orderLinesJson: null,
    orderLineCount: null,
    orderItemCount: null,
    discountBasisCents: null,
  }

  for (const legacy of [absent, nullable]) {
    const reservation = toReservation(legacy as never)
    assert.equal(reservation.orderLines, undefined)
    assert.equal(reservation.productId, 'pave-cake')
    assert.equal(reservation.totalPriceCents, 13000)
  }
})

const localReservationsKey = 'verygood-cake-reservations-au'

async function withLocalReservations(rows: unknown[], run: () => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>([[localReservationsKey, JSON.stringify(rows)]])
  const storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => { values.delete(key) },
    setItem: (key: string, value: string) => { values.set(key, value) },
  } satisfies Storage
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  try {
    await run()
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete (globalThis as { localStorage?: Storage }).localStorage
  }
}

test('repository update rejects multi-line repricing even when called outside the guarded admin form', async () => {
  const reservation = toReservation(document as never)
  await withLocalReservations([reservation], async () => {
    await assert.rejects(
      updateReservation(reservation.id, { quantity: 5, totalPrice: 1, totalPriceCents: 100 }),
      /MULTI_LINE_EDIT_UNAVAILABLE/,
    )
    const stored = JSON.parse(localStorage.getItem(localReservationsKey) || '[]')
    assert.equal(stored[0].quantity, 1)
    assert.equal(stored[0].totalPriceCents, 13000)
  })
})

test('local demo reservation storage normalizes and retains the required customer email', async () => {
  await withLocalReservations([], async () => {
    await assert.rejects(
      createReservation({
        customerName: 'Customer', customerPhone: '0412345678', customerEmail: 'not-an-email',
        productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
        chocolateIcingCount: 0, quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본',
        requestNote: '', privacyConsent: true,
      }),
      /INVALID_EMAIL/,
    )
    const reservation = await createReservation({
      customerName: 'Customer',
      customerPhone: '0412345678',
      customerEmail: ' Customer@Example.COM ',
      productId: 'pave-cake', cakeSize: '15cm', chocolateType: 'dark', poundAddon: 'none',
      chocolateIcingCount: 0, quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본',
      requestNote: '', privacyConsent: true,
    })
    const stored = JSON.parse(localStorage.getItem(localReservationsKey) || '[]')
    assert.equal(reservation.customerEmail, 'customer@example.com')
    assert.equal(stored[0]?.customerEmail, 'customer@example.com')
  })
})



test('API-off local demo preserves authoritative Brownie Basic, Pave, and Fresh cream prices and fields', async () => {
  await withLocalReservations([], async () => {
    const common = {
      customerName: 'Customer', customerPhone: '0412345678', customerEmail: 'customer@example.com',
      cakeSize: '15cm' as const, chocolateType: 'dark' as const, poundAddon: 'none' as const,
      chocolateIcingCount: 0, quantity: 1, pickupDate: '2099-07-11', pickupTime: '10:00', cacaoPercent: '기본' as const,
      requestNote: '', privacyConsent: true,
    }
    const basic = await createReservation({ ...common, productId: 'brownie-cheesecake', brownieCreamOption: 'none' })
    const fresh = await createReservation({ ...common, productId: 'brownie-cheesecake', brownieCreamOption: 'fresh-cream' })
    const pave = await createReservation({ ...common, productId: 'pave-brownie-cheesecake', brownieCreamOption: 'fresh-cream' })
    assert.deepEqual(
      [basic.totalPriceCents, basic.brownieCreamOption, fresh.totalPriceCents, fresh.brownieCreamOption, pave.totalPriceCents, pave.brownieCreamOption],
      [8500, 'none', 10500, 'fresh-cream', 9500, undefined],
    )
    const stored = JSON.parse(localStorage.getItem(localReservationsKey) || '[]')
    assert.deepEqual(stored.map((row: { totalPriceCents: number }) => row.totalPriceCents), [9500, 10500, 8500])
  })
})

test('repository rejects explicit undefined pricing fields before they can delete required versioned data', async () => {
  const reservation = toReservation(document as never)
  await withLocalReservations([reservation], async () => {
    await assert.rejects(
      updateReservation(reservation.id, { quantity: undefined }),
      /MULTI_LINE_EDIT_UNAVAILABLE/,
    )
    const stored = JSON.parse(localStorage.getItem(localReservationsKey) || '[]')
    assert.equal(Object.hasOwn(stored[0], 'quantity'), true)
    assert.equal(stored[0].quantity, 1)
  })
})

test('repository update snapshots Proxy descriptors once and persists only the validated snapshot', async () => {
  const reservation = toReservation(document as never)
  let quantityGets = 0
  const updates = new Proxy({ quantity: 1, totalPrice: 130, totalPriceCents: 13000 }, {
    get(target, key, receiver) {
      if (key === 'quantity') {
        quantityGets += 1
        return quantityGets === 1 ? 5 : 1
      }
      return Reflect.get(target, key, receiver)
    },
  })
  await withLocalReservations([reservation], async () => {
    const updated = await updateReservation(reservation.id, updates)
    const stored = JSON.parse(localStorage.getItem(localReservationsKey) || '[]')
    assert.equal(quantityGets, 0)
    assert.equal(updated.quantity, 1)
    assert.equal(stored[0].quantity, 1)
    assert.equal(stored[0].orderLines[0].quantity, 1)
  })
})

test('admin and public hydration accepts valid deterministic review-reward allocation', async () => {
  const discountedLines = [
    { ...lines[0], discountPercent: 5, discountCents: 375, totalPriceCents: 7125 },
    { ...lines[1], discountPercent: 5, discountCents: 275, totalPriceCents: 5225 },
  ]
  const discountedDocument = {
    ...document,
    orderLinesJson: JSON.stringify({ version: 1, lines: discountedLines }),
    discountBasisCents: 13000,
    discountPercent: 5,
    discountCents: 650,
    totalPriceCents: 12350,
    totalPrice: 123.5,
    reviewCouponId: 'review-coupon-1',
    appliedPromoCodeLast4: 'Q2MK',
  }
  const reservation = toReservation(discountedDocument as never)
  assert.equal(reservation.totalPriceCents, 12350)
  await withLocalReservations([reservation], async () => {
    const publicReservation = await getReservationByNumber(reservation.reservationNumber, reservation.customerPhone)
    assert.equal(publicReservation?.totalPriceCents, 12350)
    assert.equal(publicReservation?.discountBasisCents, 13000)
  })
})

test('public lookup rejects a nonzero aggregate discount without any eligible discounted line', async () => {
  const reservation = {
    ...toReservation(document as never),
    discountBasisCents: 0,
    discountPercent: 5,
    discountCents: 0,
  }
  await withLocalReservations([reservation], async () => {
    await assert.rejects(
      getReservationByNumber(reservation.reservationNumber, reservation.customerPhone),
      /INVALID_RESERVATION_RESPONSE/,
    )
  })
})

test('public lookup rejects multi-line aggregate and first-line projection inconsistencies', async () => {
  const reservation = {
    ...toReservation(document as never),
    productId: 'pound-cake',
    subtotalCents: 1,
    discountBasisCents: 999,
    discountPercent: 10,
    discountCents: 0,
  }
  await withLocalReservations([reservation], async () => {
    await assert.rejects(
      getReservationByNumber(reservation.reservationNumber, reservation.customerPhone),
      /INVALID_RESERVATION_RESPONSE/,
    )
  })
})
