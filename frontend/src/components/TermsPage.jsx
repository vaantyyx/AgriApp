import { useNavigate } from 'react-router-dom';
import { Leaf, ArrowLeft } from 'lucide-react';
import SiteNavbar from './SiteNavbar';

// Conditions Générales d'Utilisation — contenu repris du document officiel
// "CONDITIONS GÉNÉRALES D'UTILISATION — PLATEFORME SOUGRA".
const SECTIONS = [
  {
    title: "TITRE I — DISPOSITIONS COMMUNES À TOUS LES UTILISATEURS",
    articles: [
      {
        heading: "Article 1 — Objet et Acceptation des CGU",
        paragraphs: [
          "1.1. Les présentes CGU (Conditions Générales d'Utilisation) régissent l'accès et l'utilisation de la plateforme SOUGRA.",
          "1.2. L'utilisation de la Plateforme implique l'acceptation pleine et entière des présentes CGU. L'Utilisateur déclare en avoir pris connaissance et les accepter sans réserve en cochant la case « Je déclare avoir lu et accepté les Conditions Générales d'Utilisation de SOUGRA » lors de la création de son compte.",
          "1.3. Pour l'accès par USSD, l'acceptation est matérialisée par la validation du code de confirmation envoyé, valant consentement électronique au sens de la loi 18-05.",
        ],
      },
      {
        heading: "Article 2 — Définitions",
        list: [
          "Plateforme : le service numérique SOUGRA (web, mobile, USSD) d'intermédiation par enchères inversées.",
          "Éditeur : la société exploitant SOUGRA, agissant en qualité d'intermédiaire technique.",
          "Acheteur : professionnel (industriel, grossiste, exportateur, GMS) publiant un Besoin.",
          "Vendeur / Producteur : agriculteur ou coopérative soumettant une Offre de prix.",
          "Utilisateur : tout Acheteur ou Vendeur inscrit.",
          "Enchère inversée : mécanisme par lequel les Vendeurs proposent des prix décroissants en réponse au Besoin d'un Acheteur.",
          "Besoin : demande ferme publiée par l'Acheteur (produit, quantité, qualité, délai, lieu).",
          "Offre : proposition de prix soumise par un Vendeur, ferme et irrévocable pendant la durée de l'enchère.",
          "Séquestre (Escrow) : mécanisme de blocage des fonds jusqu'à confirmation de livraison conforme.",
          "Souk Score : indice de réputation attribué aux Utilisateurs.",
        ],
      },
      {
        heading: "Article 3 — Inscription et Comptes",
        paragraphs: [
          "3.1. L'inscription est réservée aux professionnels (personnes physiques ou morales exerçant une activité agricole ou commerciale déclarée).",
          "3.2. L'Utilisateur garantit l'exactitude des informations fournies (identité, RC/carte fellah, NIF, coordonnées bancaires/mobiles). L'Éditeur se réserve le droit de vérifier ces informations et de demander tout justificatif.",
          "3.3. L'Utilisateur est seul responsable de la confidentialité de ses identifiants. Toute action réalisée via son compte lui est imputable.",
          "3.4. Un seul compte par entité professionnelle est autorisé.",
        ],
      },
      {
        heading: "Article 4 — Règles de Fonctionnement des Enchères Inversées",
        paragraphs: [
          "4.1. L'Acheteur publie un Besoin constituant une offre ferme de contracter aux conditions décrites.",
          "4.2. Les Vendeurs qualifiés soumettent leurs Offres de prix de manière anonyme. L'anonymat est levé à la clôture de l'enchère, uniquement entre les parties concernées par l'attribution.",
          "4.3. L'enchère est régie par un compte à rebours. Toute Offre soumise après la clôture est irrecevable. Une prolongation automatique (anti-sniping) peut s'appliquer si une Offre intervient dans les dernières secondes.",
          "4.4. L'attribution s'effectue selon le meilleur score global (prix pondéré par la fiabilité, la proximité et le Souk Score), les critères étant communiqués à l'Acheteur.",
          "4.5. L'attribution forme un contrat de vente ferme entre l'Acheteur et le Vendeur retenu.",
        ],
      },
      {
        heading: "Article 5 — Protection des Données Personnelles (Conformité Loi 18-07)",
        paragraphs: [
          "Conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel, l'Éditeur s'engage à :",
          "5.1. Finalités : collecter les données uniquement pour la gestion des comptes, la mise en relation pour les enchères, le traitement des paiements, la lutte anti-fraude et l'amélioration des services.",
          "5.2. Consentement : obtenir le consentement explicite de l'Utilisateur pour toute collecte, y compris pour l'usage de l'assistant vocal (enregistrements en darija/tamazight) et de la géolocalisation.",
          "5.3. Droits : garantir les droits d'accès, de rectification, d'opposition et d'effacement, exerçables à support@sougra.com.",
          "5.4. Sécurité : mettre en œuvre toutes les mesures techniques (chiffrement, contrôle d'accès) pour protéger les données.",
          "5.5. Déclaration/Autorisation : le traitement fait l'objet, le cas échéant, d'une déclaration ou autorisation auprès de l'Autorité Nationale de Protection des Données Personnelles (ANPDP).",
          "5.6. Durée de conservation et absence de transfert hors des finalités : les données ne sont pas cédées à des tiers sans base légale.",
        ],
      },
      {
        heading: "Article 6 — Preuve et Signature Électronique (Conformité Loi 18-05)",
        paragraphs: [
          "6.1. Conformément à la loi n° 18-05 du 10 mai 2018 relative au commerce électronique, les registres électroniques de SOUGRA (journaux, horodatages, identifiants de connexion, historique des enchères) font foi entre les parties.",
          "6.2. La signature électronique de l'Utilisateur (via identifiant/mot de passe, OTP SMS ou validation USSD) vaut signature manuscrite et constitue une preuve de son engagement.",
          "6.3. L'Éditeur, en tant que fournisseur de service de commerce électronique, tient à disposition ses informations légales conformément à l'article 8 de la loi 18-05.",
        ],
      },
      {
        heading: "Article 7 — Propriété Intellectuelle",
        paragraphs: [
          "7.1. La Plateforme, ses algorithmes (matching, prédiction, NLP), sa charte, ses marques et son code sont la propriété exclusive de l'Éditeur.",
          "7.2. Aucune reproduction, extraction ou réutilisation n'est autorisée sans accord écrit. Les données publiées par l'Utilisateur restent sa propriété, celui-ci concédant une licence d'usage nécessaire au fonctionnement du service.",
        ],
      },
      {
        heading: "Article 8 — Limitations de Responsabilité",
        paragraphs: [
          "8.1. L'Éditeur agit exclusivement comme intermédiaire technique. Il n'est ni acheteur ni vendeur et n'est pas partie au contrat de vente conclu entre Utilisateurs.",
          "8.2. L'Éditeur n'est pas responsable de la qualité, conformité ou existence réelle des marchandises, ni de la solvabilité des parties, sous réserve de ses obligations de vérification raisonnable.",
          "8.3. La responsabilité de l'Éditeur ne saurait être engagée en cas de force majeure, d'interruption des réseaux télécoms/USSD, ou de faute d'un Utilisateur.",
        ],
      },
      {
        heading: "Article 9 — Résiliation et Suspension",
        paragraphs: [
          "9.1. L'Utilisateur peut clôturer son compte à tout moment, sous réserve de l'exécution des transactions en cours.",
          "9.2. L'Éditeur peut suspendre ou résilier un compte, sans préavis, en cas de manquement aux CGU, de fraude, de fausse déclaration ou d'atteinte à la sécurité.",
        ],
      },
      {
        heading: "Article 10 — Sanctions",
        paragraphs: [
          "Tout manquement aux présentes CGU ou à la réglementation applicable, notamment les lois 18-05 et 18-07, pourra entraîner la suspension ou la résiliation du compte, la perte du Souk Score et de la cagnotte, sans préjudice des poursuites judiciaires et des amendes prévues par la loi (notamment les sanctions pénales de la loi 18-07 en matière de données personnelles).",
        ],
      },
      {
        heading: "Article 11 — Loi Applicable et Juridiction",
        paragraphs: [
          "11.1. Les présentes CGU sont régies par le droit algérien.",
          "11.2. Tout litige, à défaut de résolution amiable, relève de la compétence exclusive des tribunaux d'Alger (ou du tribunal du siège de l'Éditeur).",
        ],
      },
    ],
  },
  {
    title: "TITRE II — DISPOSITIONS SPÉCIFIQUES AUX ACHETEURS",
    articles: [
      {
        heading: "Article 12 — Obligations de l'Acheteur",
        paragraphs: [
          "12.1. Fermeté du Besoin : la publication d'un Besoin engage l'Acheteur à contracter avec le Vendeur retenu aux conditions publiées.",
          "12.2. Paiement : l'Acheteur s'oblige à provisionner le séquestre dès l'attribution de l'enchère.",
          "12.3. Réception : l'Acheteur doit inspecter la marchandise à la livraison et confirmer la conformité dans le délai imparti (à défaut, la conformité est réputée acquise).",
          "12.4. Notation : l'Acheteur note le Vendeur de bonne foi (Souk Score).",
        ],
      },
      {
        heading: "Article 13 — Modalités de Paiement (Acheteur)",
        paragraphs: [
          "13.1. Une commission SOUGRA est due, prélevée conformément à l'Article 15.",
          "13.3. Une facture conforme à la réglementation fiscale algérienne est émise pour chaque transaction et commission.",
        ],
      },
      {
        heading: "Article 14 — Défaut de Paiement de l'Acheteur",
        paragraphs: [
          "Le non-provisionnement du séquestre constitue un manquement grave entraînant l'annulation de l'attribution, une pénalité, la dégradation du Souk Score et, en cas de récidive, la suspension du compte.",
        ],
      },
    ],
  },
  {
    title: "TITRE III — DISPOSITIONS SPÉCIFIQUES AUX PRODUCTEURS / VENDEURS",
    articles: [
      {
        heading: "Article 15 — Obligations du Vendeur",
        paragraphs: [
          "15.1. Fermeté de l'Offre : toute Offre soumise est ferme et irrévocable pendant la durée de l'enchère.",
          "15.2. Qualité et conformité : le Vendeur garantit que la marchandise livrée est conforme (quantité, calibre, qualité sanitaire) aux caractéristiques du Besoin et à son Offre.",
          "15.3. Livraison : le Vendeur s'engage à livrer dans le délai et au lieu convenus. Tout retard ou défaut de livraison engage sa responsabilité.",
          "15.4. Traçabilité : le Vendeur fournit les informations d'origine requises.",
        ],
      },
      {
        heading: "Article 16 — Modalités de Paiement (Vendeur)",
        paragraphs: [
          "16.1. Après confirmation de livraison conforme par l'Acheteur, les fonds sont débloqués du séquestre au profit du Vendeur, déduction faite de la commission SOUGRA. Le versement s'effectue sur le compte bancaire ou le portefeuille mobile (BaridiMob) déclaré par le Vendeur, dans un délai convenu de jours ouvrés.",
        ],
      },
      {
        heading: "Article 17 — Défaut de Livraison ou Non-Conformité",
        paragraphs: [
          "En cas de non-livraison ou de non-conformité constatée, les fonds séquestrés sont remboursés à l'Acheteur (totalement ou partiellement), le Vendeur s'exposant à une pénalité, à la dégradation du Souk Score et à la suspension du compte.",
        ],
      },
    ],
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <>
    <SiteNavbar />
    <div style={{ flex: 1, padding: '32px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 820, width: '100%' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Retour
        </button>

        <div className="glass-panel" style={{ padding: '40px 44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, background: 'var(--primary)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Leaf size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
              Sougra
            </span>
          </div>

          <h1 style={{ fontSize: '1.6rem', marginTop: 20, marginBottom: 4 }}>
            Conditions Générales d'Utilisation
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 8 }}>
            Plateforme B2B d'enchères inversées agricoles — Sougra
          </p>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginBottom: 32 }}>
            Version faisant foi : français. Régie par le droit algérien.
          </p>

          {SECTIONS.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 36 }}>
              <h2 style={{
                fontSize: '1rem', fontWeight: 800, color: 'var(--primary)',
                textTransform: 'uppercase', letterSpacing: '0.02em',
                paddingBottom: 10, marginBottom: 20, borderBottom: '1px solid var(--border)',
              }}>
                {section.title}
              </h2>

              {section.articles.map((article, aIdx) => (
                <div key={aIdx} style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>
                    {article.heading}
                  </h3>

                  {article.paragraphs?.map((p, pIdx) => (
                    <p key={pIdx} style={{ color: 'var(--text-body)', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: 10 }}>
                      {p}
                    </p>
                  ))}

                  {article.list && (
                    <ul style={{ margin: '0 0 10px', paddingInlineStart: 22 }}>
                      {article.list.map((item, lIdx) => (
                        <li key={lIdx} style={{ color: 'var(--text-body)', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: 6 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div style={{
            marginTop: 32, padding: '18px 20px', borderRadius: 12,
            background: 'var(--primary-soft)', border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 700, marginBottom: 6 }}>
              MENTION D'ACCEPTATION
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-body)', lineHeight: 1.6, margin: 0 }}>
              « Je déclare avoir lu et accepté les Conditions Générales d'Utilisation de SOUGRA. » Fait par voie électronique — l'horodatage et l'identifiant de connexion valant signature au sens de la loi 18-05.
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
