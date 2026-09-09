function sanitizedOrderLine(line, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS) {
  return {
    productId: line.productId,
    cakeSize: line.cakeSize,
    chocolateType: line.chocolateType,
    poundAddon: line.poundAddon,
    ...(Object.hasOwn(line, 'cupcakeFinish') ? { cupcakeFinish: line.cupcakeFinish } : {}),
    chocolateIcingCount: line.chocolateIcingCount,
    chocolateExtra: line.chocolateExtra || 'none',
    ...(BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS.has(line.productId)
      && Object.hasOwn(line, 'brownieCreamOption')
      ? { brownieCreamOption: line.brownieCreamOption }
      : {}),
    chocolateExtraCents: Number.isSafeInteger(line.chocolateExtraCents) ? line.chocolateExtraCents : 0,
    vanillaCreamCount: line.vanillaCreamCount,
    partyDecorationCount: line.partyDecorationCount,
    vanillaCakeSheet: line.vanillaCakeSheet,
    vanillaCakeFlavor: line.vanillaCakeFlavor,
    vanillaCakePointColor: line.vanillaCakePointColor || 'pink',
    ...(Object.hasOwn(line, 'individualPackaging') ? { individualPackaging: line.individualPackaging === true } : {}),
    quantity: line.quantity,
  }
}

export function projectPublicCakeReservation(document, parseStoredOrderLines, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS) {
  const stored = parseStoredOrderLines(document)
  const legacyLine = {
    productId: document.productId || 'pave-cake',
    cakeSize: document.cakeSize || '15cm',
    chocolateType: document.chocolateType || 'dark',
    poundAddon: document.poundAddon || 'none',
    ...(Object.hasOwn(document, 'cupcakeFinish') ? { cupcakeFinish: document.cupcakeFinish } : {}),
    chocolateIcingCount: Number(document.chocolateIcingCount || 0),
    vanillaCreamCount: Number(document.vanillaCreamCount || 0),
    partyDecorationCount: Number(document.partyDecorationCount || 0),
    vanillaCakeSheet: document.vanillaCakeSheet || (document.productId === 'vanilla-fresh-cream-cake' ? 'chocolate' : 'vanilla'),
    vanillaCakeFlavor: document.vanillaCakeFlavor || 'triple-berry',
    vanillaCakePointColor: 'pink',
    chocolateExtra: 'none',
    chocolateExtraCents: 0,
    quantity: Number(document.quantity || 1),
  }
  const orderLines = stored
    ? stored.lines.map((line) => ({
        ...sanitizedOrderLine(line, BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS),
        unitPriceCents: line.unitPriceCents,
        subtotalCents: line.subtotalCents,
        discountPercent: line.discountPercent,
        discountCents: line.discountCents,
        ...(Object.hasOwn(line, 'individualPackagingPieces') ? {
          individualPackagingPieces: line.individualPackagingPieces,
          individualPackagingFeeCents: line.individualPackagingFeeCents,
        } : {}),
        totalPriceCents: line.totalPriceCents,
      }))
    : [legacyLine]
  const firstLine = sanitizedOrderLine(orderLines[0], BROWNIE_CREAM_ELIGIBLE_PRODUCT_IDS)
  return {
    reservationNumber: document.reservationNumber,
    ...firstLine,
    pickupDate: document.pickupDate,
    pickupTime: document.pickupTime,
    cacaoPercent: document.cacaoPercent || '기본',
    status: document.status,
    paymentStatus: document.paymentStatus,
    orderLines,
    orderLineCount: orderLines.length,
    orderItemCount: orderLines.reduce((sum, line) => sum + line.quantity, 0),
    ...(stored ? {
      subtotalCents: document.subtotalCents,
      discountBasisCents: document.discountBasisCents,
      discountPercent: document.discountPercent,
      discountCents: document.discountCents,
      ...(Object.hasOwn(document, 'individualPackagingPieces') ? {
        individualPackagingPieces: Number(document.individualPackagingPieces || 0),
        individualPackagingFeeCents: Number(document.individualPackagingFeeCents || 0),
      } : {}),
      totalPriceCents: document.totalPriceCents,
    } : {}),
  }
}
