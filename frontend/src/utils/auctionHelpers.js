/** Resolve which bid line was accepted (whole-bid acceptance uses the single line or null for multi-option packages). */
export function resolveAcceptedLine(bid, acceptedLineId) {
  if (!bid?.lines?.length) return null;
  if (acceptedLineId) {
    return bid.lines.find(l => l.id === acceptedLineId) ?? null;
  }
  if (bid.lines.length === 1) return bid.lines[0];
  return null;
}

/** Whether a specific line within a bid was accepted. */
export function isBidLineAccepted(auction, bid, line) {
  if (auction.acceptedBidId !== bid.id) return false;
  if (auction.acceptedLineId) return auction.acceptedLineId === line.id;
  return true;
}

export function getWinnerCongratsMessage({ bid, acceptedLineId, auction, t }) {
  const lines = bid?.lines || [];
  const line = resolveAcceptedLine(bid, acceptedLineId);

  if (line?.optionName) {
    return t('bidWinnerCongratsOption', {
      option: line.optionName,
      price: line.price,
      unit: t('unit_' + (line.unit || auction.unit)),
    });
  }
  if (line) {
    return t('bidWinnerCongrats', {
      price: line.price,
      unit: t('unit_' + (line.unit || auction.unit)),
    });
  }
  if (lines.length > 1) {
    return t('bidWinnerCongratsPackage', { count: lines.length });
  }
  return t('bidWinnerCongratsGeneric');
}

export function getBidClosedWinnerMessage({ winningBid, acceptedLineId, auction, t, locale }) {
  const line = resolveAcceptedLine(winningBid, acceptedLineId);

  if (line?.optionName) {
    return t('bidClosedWinnerOption', {
      name: winningBid?.producerAlias,
      option: line.optionName,
      price: line.price,
      unit: t('unit_' + (line.unit || auction.unit)),
    });
  }
  if (line) {
    return t('bidClosedWinner', {
      name: winningBid?.producerAlias,
      price: line.price,
      unit: t('unit_' + (line.unit || auction.unit)),
    });
  }
  if (winningBid?.lines?.length > 1) {
    return t('bidClosedWinnerPackage', {
      name: winningBid.producerAlias,
      count: winningBid.lines.length,
    });
  }
  if (winningBid?.lines?.[0]?.optionName) {
    return locale === 'ar'
      ? `تم إغلاق المناقصة. تم قبول عرض ${winningBid.producerAlias} للخيار "${winningBid.lines[0].optionName}".`
      : `L'enchère est clôturée. L'offre de ${winningBid.producerAlias} pour l'option "${winningBid.lines[0].optionName}" a été acceptée.`;
  }
  return locale === 'ar'
    ? `تم إغلاق المناقصة. تم قبول عرض ${winningBid?.producerAlias || 'المنافس'}.`
    : `L'enchère est clôturée. L'offre de ${winningBid?.producerAlias || 'concurrent'} a été acceptée.`;
}
