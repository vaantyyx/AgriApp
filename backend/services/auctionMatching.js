// Geographic + product matching helpers and the buyer/producer anonymization
// logic for auctions. Extracted out of server.js so this logic (previously
// only reachable by running the whole Socket.IO server) can be unit tested
// directly.

// ─── Geographic Helpers (Haversine) ───────────────────────────────────────
// Approximate centers of Algeria's 69 wilayas
export const WILAYA_COORDS = {
  1:{lat:27.87,lng:-0.29},2:{lat:36.17,lng:1.33},3:{lat:33.80,lng:2.88},
  4:{lat:35.93,lng:7.11},5:{lat:35.56,lng:6.17},6:{lat:36.75,lng:5.08},
  7:{lat:34.85,lng:5.73},8:{lat:31.61,lng:-2.21},9:{lat:36.47,lng:2.83},
  10:{lat:36.37,lng:3.90},11:{lat:22.79,lng:5.52},12:{lat:35.40,lng:8.12},
  13:{lat:34.88,lng:-1.32},14:{lat:35.37,lng:1.32},15:{lat:36.71,lng:4.05},
  16:{lat:36.73,lng:3.09},17:{lat:34.67,lng:3.25},18:{lat:36.82,lng:5.77},
  19:{lat:36.19,lng:5.41},20:{lat:34.83,lng:0.15},21:{lat:36.90,lng:6.91},
  22:{lat:35.19,lng:-0.63},23:{lat:36.90,lng:7.77},24:{lat:36.46,lng:7.43},
  25:{lat:36.37,lng:6.61},26:{lat:36.27,lng:2.75},27:{lat:35.93,lng:0.09},
  28:{lat:35.70,lng:4.54},29:{lat:35.40,lng:0.14},30:{lat:31.95,lng:5.33},
  31:{lat:35.70,lng:-0.63},32:{lat:33.68,lng:1.02},33:{lat:26.50,lng:8.47},
  34:{lat:36.07,lng:4.76},35:{lat:36.77,lng:3.48},36:{lat:36.77,lng:8.31},
  37:{lat:27.67,lng:-8.14},38:{lat:35.59,lng:1.81},39:{lat:33.37,lng:6.86},
  40:{lat:35.43,lng:7.14},41:{lat:36.29,lng:7.94},42:{lat:36.58,lng:2.46},
  43:{lat:36.45,lng:6.27},44:{lat:36.26,lng:1.97},45:{lat:33.27,lng:-0.31},
  46:{lat:35.30,lng:-1.14},47:{lat:32.49,lng:3.67},48:{lat:35.73,lng:0.56},
  49:{lat:29.26,lng:0.23},50:{lat:21.33,lng:0.95},51:{lat:34.42,lng:5.07},
  52:{lat:30.13,lng:-2.16},53:{lat:27.22,lng:2.47},54:{lat:19.57,lng:5.77},
  55:{lat:33.09,lng:6.06},56:{lat:24.56,lng:9.48},57:{lat:33.93,lng:6.13},
  58:{lat:30.58,lng:2.88},59:{lat:33.81,lng:2.01},60:{lat:32.89,lng:0.53},
  61:{lat:34.22,lng:-1.26},62:{lat:35.02,lng:5.73},63:{lat:35.38,lng:5.37},
  64:{lat:35.21,lng:4.18},65:{lat:35.01,lng:7.94},66:{lat:35.88,lng:2.75},
  67:{lat:35.18,lng:2.32},68:{lat:35.45,lng:2.64},69:{lat:34.15,lng:3.55},
};

export const WILAYA_NAME_TO_ID = {
  'adrar':1,'chlef':2,'laghouat':3,'oum el bouaghi':4,'batna':5,'bejaia':6,
  'biskra':7,'bechar':8,'blida':9,'bouira':10,'tamanrasset':11,'tebessa':12,
  'tlemcen':13,'tiaret':14,'tizi ouzou':15,'alger':16,'djelfa':17,'jijel':18,
  'setif':19,'saida':20,'skikda':21,'sidi bel abbes':22,'annaba':23,'guelma':24,
  'constantine':25,'medea':26,'mostaganem':27,"m'sila":28,'mascara':29,
  'ouargla':30,'oran':31,'el bayadh':32,'illizi':33,'bordj bou arreridj':34,
  'boumerdes':35,'el tarf':36,'tindouf':37,'tissemsilt':38,'el oued':39,
  'khenchela':40,'souk ahras':41,'tipaza':42,'mila':43,'ain defla':44,
  'naama':45,'ain temouchent':46,'ghardaia':47,'relizane':48,'timimoun':49,
  'bordj badji mokhtar':50,'ouled djellal':51,'beni abbes':52,'in salah':53,
  'in guezzam':54,'touggourt':55,'djanet':56,"el m'ghair":57,'el meniaa':58,
  'aflou':59,'el abiodh sidi cheikh':60,'el aricha':61,'el kantara':62,
  'barika':63,'bou saada':64,'bir el ater':65,'ksar el boukhari':66,
  'ksar chellala':67,'ain oussara':68,'messaad':69,
};

function toRad(d) { return d * Math.PI / 180; }

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns approximate coordinates for a wilaya by name. */
export function getWilayaCoords(wilayaName) {
  if (!wilayaName) return null;
  const id = WILAYA_NAME_TO_ID[wilayaName.toLowerCase().trim()];
  return id ? WILAYA_COORDS[id] : null;
}

/** Deterministic commune offset so each commune has a unique stable position. */
export function getCommuneCoords(wilayaName, communeName) {
  const base = getWilayaCoords(wilayaName);
  if (!base) return null;
  // Derive a numeric seed from communeName characters
  let seed = 0;
  for (let i = 0; i < communeName.length; i++) {
    seed = (seed * 31 + communeName.charCodeAt(i)) >>> 0;
  }
  const u1 = ((seed & 0xFFFF) / 0xFFFF) - 0.5;
  const u2 = (((seed >>> 16) & 0xFFFF) / 0xFFFF) - 0.5;
  return { lat: base.lat + u1 * 0.45, lng: base.lng + u2 * 0.45 };
}

/**
 * Returns true if the producer (at pCoords) is within the buyer's search zone.
 * Falls back to true when coordinates are unknown (show auction by default).
 */
export function isProducerInZone(auction, pCoords) {
  if (!pCoords) return true;
  if (!auction.buyerLat || !auction.buyerLng) return true;
  const dist = haversineKm(auction.buyerLat, auction.buyerLng, pCoords.lat, pCoords.lng);
  return dist <= (auction.radiusKm || 100);
}

// ─── Products Map for Smart Auctions ─────────────────────────────────────
export const PRODUCTS_MAP = {
  '1': 'Blé Dur',
  '2': 'Blé Tendre',
  '3': 'Orge',
  '4': 'Maïs',
  '5': 'Avoine',
  '6': 'Légumineuses',
  '7': 'Olivier',
  '8': 'Pommier',
  '9': 'Agrumes',
  '10': 'Datte',
  '11': 'Amandier',
  '12': 'Cerisier',
  '13': 'Figuier',
  '14': 'Abricotier',
  '15': 'Tomate',
  '16': 'Pomme de terre',
  '17': 'Oignon',
  '18': 'Piment',
  '19': 'Laitue',
  '20': 'Carotte',
  '21': 'Melon',
  '22': 'Pastèque',
  '23': 'Luzerne',
  '24': 'Sorgho',
  '25': 'Bersim',
  '26': 'Maïs fourrager',
  '27': 'Raisin de table',
  '28': 'Raisin de cuve',
};

export async function hasProducerProduct(producerId, requestedProductNames, db) {
  if (!requestedProductNames || requestedProductNames.length === 0) return true;
  const parcelles = await db.collection('parcelles').find({ userId: producerId }).toArray();
  for (const p of parcelles) {
    if (!p.cultures) continue;
    for (const c of p.cultures) {
      if (!c.sous_type_culture) continue;
      const match = c.sous_type_culture.some(prodName =>
        requestedProductNames.some(reqName => reqName.toLowerCase().trim() === prodName.toLowerCase().trim())
      );
      if (match) return true;
    }
  }
  return false;
}

export async function canProducerParticipate(auction, producerId, pCoords, db) {
  if (!isProducerInZone(auction, pCoords)) return false;

  if (auction.auctionType === 'smart') {
    const requestedProductNames = (auction.lots || []).map(l => PRODUCTS_MAP[l.productId]).filter(Boolean);
    if (requestedProductNames.length === 0 && auction.product) {
      const fallback = PRODUCTS_MAP[auction.product] || auction.product;
      requestedProductNames.push(fallback);
    }
    return await hasProducerProduct(producerId, requestedProductNames, db);
  }

  return true;
}

// ─── Anonymization helper ─────────────────────────────────────────────────
/**
 * Strips real names from auction/bid data for a given requesting user.
 * - Buyer requesting: sees their own name, all producers are anonymized.
 * - Producer requesting: sees anonymous buyer, own bids labelled "(Vous)", competitors anonymized.
 * Also injects per-producer average rating from bids metadata.
 */
export function sanitizeAuctions(auctions, requestingUserId, requestingRole) {
  return auctions.map(auction => {
    // Sanitize buyer name
    const buyerDisplay = requestingUserId === auction.buyerId
      ? auction.buyerName
      : 'Acheteur Anonyme';

    // Build a stable anonymous alias per producer within this auction
    const producerAliasMap = {};
    let aliasCounter = 1;
    (auction.bids || []).forEach(bid => {
      if (!producerAliasMap[bid.producerId]) {
        if (bid.producerId === requestingUserId) {
          producerAliasMap[bid.producerId] = 'Vous';
        } else {
          producerAliasMap[bid.producerId] = `Producteur #${aliasCounter++}`;
        }
      }
    });

    // Calculate rankings for all bids on this auction (based on average price of lines)
    const bidComparisonPrices = (auction.bids || []).map(bid => {
      const sum = (bid.lines || []).reduce((acc, line) => acc + (parseFloat(line.price) || 0), 0);
      const avgPrice = (bid.lines || []).length > 0 ? (sum / bid.lines.length) : 0;
      return {
        producerId: bid.producerId,
        avgPrice,
      };
    });

    // Sort bids by average price ascending (lowest price first)
    bidComparisonPrices.sort((a, b) => a.avgPrice - b.avgPrice);

    // Create a map of producerId -> rank (1-based index)
    const rankMap = {};
    bidComparisonPrices.forEach((item, index) => {
      rankMap[item.producerId] = index + 1;
    });

    const myBid = (auction.bids || []).find(b => b.producerId === requestingUserId);
    const myRank = myBid ? rankMap[requestingUserId] : null;
    const totalBidders = (auction.bids || []).length;

    const sanitizedBids = (auction.bids || []).map(bid => ({
      id: bid.id,
      producerAlias: producerAliasMap[bid.producerId] || 'Producteur Anonyme',
      // Rating info is safe to expose (anonymous average)
      producerRating: bid.producerRating ?? null,
      producerRatingCount: bid.producerRatingCount ?? 0,
      timestamp: bid.timestamp,
      lines: (bid.lines || []).map(line => ({
        id: line.id,
        price: (requestingRole === 'producer' && bid.producerId !== requestingUserId) ? null : line.price,
        quantity: line.quantity || null,
        optionName: line.optionName || '',
        unit: line.unit || auction.unit,
        comments: line.comments || '',
        images: line.images || [],
      }))
    }));

    return {
      id: auction.id,
      buyerDisplay,
      // Only buyer sees their own real demand location context, except producers who need it to bid
      deliveryLocation: (requestingUserId === auction.buyerId || requestingRole === 'producer') ? auction.deliveryLocation : 'Zone de livraison',
      title: auction.title || auction.product,
      auctionType: auction.auctionType || 'open',
      product: auction.product,
      quantity: auction.quantity,
      unit: auction.unit,
      description: auction.description,
      lots: auction.lots || [],
      radiusKm: auction.radiusKm,
      startAt: auction.startAt,
      endAt: auction.endAt,
      autoProlongate: auction.autoProlongate || false,
      prolongationMinutes: auction.prolongationMinutes || null,
      maxProlongations: auction.maxProlongations || null,
      targetPrice: auction.targetPrice,
      status: auction.status,
      createdAt: auction.createdAt,
      bids: sanitizedBids,
      acceptedBidId: auction.acceptedBidId,
      acceptedLineId: auction.acceptedLineId || null,
      // Indicates if current user is the buyer of this auction
      isOwner: auction.buyerId === requestingUserId,
      // Producer's own bid reference
      myBidId: requestingRole === 'producer'
        ? ((auction.bids || []).find(b => b.producerId === requestingUserId)?.id ?? null)
        : null,
      // Buyer: already rated flag
      alreadyRated: auction.alreadyRated || false,
      myRank: requestingRole === 'producer' ? myRank : null,
      totalBidders: requestingRole === 'producer' ? totalBidders : null,
    };
  });
}
