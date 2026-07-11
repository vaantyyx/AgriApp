/** Resolve the display title for a notification, keyed by its `type`. */
export function getNotificationTitle(n, t) {
  if (n.type === 'new_bid') return t('newBidNotificationTitle');
  if (n.type === 'bid_accepted') return t('bidAcceptedNotificationTitle');
  if (n.type === 'auction_scheduled') return t('auctionScheduledNotificationTitle');
  if (n.type === 'auction_starting_soon') return t('auctionStartingSoonNotificationTitle');
  if (n.type === 'auction_canceled') return t('auctionCanceledNotificationTitle');
  return t('newDemandAtDistance', { distance: n.distanceKm || 0 });
}

/** Resolve the display body for a notification, keyed by its `type`. */
export function getNotificationBody(n, t) {
  if (n.type === 'new_bid') return t('newBidNotificationBody', { product: n.product });
  if (n.type === 'bid_accepted') {
    if (n.price != null) {
      return t('bidAcceptedNotificationBody', {
        product: n.product,
        price: n.price,
        unit: t('unit_' + (n.unit || 'tonnes')),
      });
    }
    return t('bidAcceptedNotificationBodyPackage', {
      product: n.product,
      count: n.optionCount || 0,
    });
  }
  if (n.type === 'auction_scheduled') {
    return t('auctionScheduledNotificationBody', {
      product: n.product,
      date: n.startAt ? new Date(n.startAt).toLocaleString('fr-DZ', { dateStyle: 'medium', timeStyle: 'short' }) : '',
    });
  }
  if (n.type === 'auction_starting_soon') {
    return t('auctionStartingSoonNotificationBody', { product: n.product });
  }
  if (n.type === 'auction_canceled') {
    return t('auctionCanceledNotificationBody', { product: n.product });
  }
  return `${n.product} — ${n.quantity} ${t('unit_' + n.unit)}`;
}
