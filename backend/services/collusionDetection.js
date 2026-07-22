// Bloc C — anti-collusion ("Détection cartel" in the logigramme).
//
// A real cartel-detection system is a research problem; this is deliberately
// a cheap, bounded heuristic rather than an attempt at one. It only ever
// *flags* an auction for admin review — it never blocks anything — because a
// simple heuristic like this will have false positives (a buyer who's
// legitimately found one trustworthy producer looks identical to a buyer
// steering wins to a kickback partner).
//
// Signal used: does one producer win an unusually large share of a given
// buyer's recent accepted auctions? A healthy market has wins spread across
// several producers; a single producer winning nearly everything, repeatedly,
// is at least worth a human looking at.

export const MIN_HISTORY_SAMPLE = 5;
export const REPEATED_PAIRING_THRESHOLD = 0.7;

/**
 * Pure function: given the winning producerId of a buyer's past closed
 * auctions (any order, excluding the auction currently being accepted) and
 * the producerId about to win this one, returns whether that pairing looks
 * suspiciously repetitive. Never flags below MIN_HISTORY_SAMPLE — too small
 * a sample to mean anything.
 */
export function detectRepeatedPairing(pastWinnerProducerIds, producerId) {
  const sampleSize = (pastWinnerProducerIds || []).length;
  if (sampleSize < MIN_HISTORY_SAMPLE) {
    return { flagged: false, ratio: null, sampleSize };
  }
  const winsForThisProducer = pastWinnerProducerIds.filter(id => id === producerId).length;
  const ratio = winsForThisProducer / sampleSize;
  return { flagged: ratio >= REPEATED_PAIRING_THRESHOLD, ratio, sampleSize };
}

/**
 * Looks up a buyer's recent accepted-auction history and runs
 * detectRepeatedPairing against the producer about to win the current one.
 * `excludeAuctionId` keeps the auction being accepted right now out of its
 * own history sample.
 */
export async function checkForCollusion(db, { buyerId, producerId, excludeAuctionId, historyLimit = 20 }) {
  const pastAuctions = await db.collection('auctions')
    .find({ buyerId, status: 'closed', acceptedBidId: { $ne: null }, id: { $ne: excludeAuctionId } })
    .sort({ createdAt: -1 })
    .limit(historyLimit)
    .toArray();

  const pastWinnerProducerIds = pastAuctions
    .map(a => (a.bids || []).find(b => b.id === a.acceptedBidId)?.producerId)
    .filter(Boolean);

  return detectRepeatedPairing(pastWinnerProducerIds, producerId);
}
