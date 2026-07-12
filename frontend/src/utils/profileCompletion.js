export function computeBuyerCompletion(user) {
  if (!user) return 0;
  const isEntreprise = user.entity_type === 'entreprise';
  if (!isEntreprise) {
    let score = 0;
    if (user.wilaya && user.wilaya.trim()) score += 34;
    if (user.commune && user.commune.trim()) score += 33;
    if (user.phone && user.phone.trim()) score += 33;
    return score;
  } else {
    let score = 0;
    if (user.wilaya && user.wilaya.trim()) score += 10;
    if (user.commune && user.commune.trim()) score += 10;
    if (user.phone && user.phone.trim()) score += 10;
    if (user.forme_juridique && user.forme_juridique.trim()) score += 10;
    if (user.rc && user.rc.trim()) score += 10;
    if (user.nif && user.nif.trim()) score += 10;
    if (user.secteur_activite && user.secteur_activite.trim()) score += 10;
    if (user.nom_commercial && user.nom_commercial.trim()) score += 30;
    return score;
  }
}

export function computeProducerCompletion(user) {
  if (!user) return 0;
  let score = 0;
  if (user.wilaya && user.wilaya.trim()) score += 15;
  if (user.commune && user.commune.trim()) score += 15;
  if (user.phone && user.phone.trim()) score += 15;
  if (user.numeroCarteAgriculteur && user.numeroCarteAgriculteur.trim()) score += 15;
  if (user.ficheSignaletiqueDocument) score += 20;
  if (user.carteAgriculteurDocument) score += 20;
  return score;
}
