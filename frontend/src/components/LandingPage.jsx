import React from 'react';
import { Sprout, Tractor, ShoppingBag, Zap, ShieldCheck, Image, ArrowRight } from 'lucide-react';

export default function LandingPage({ onNavigateToLogin }) {
  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">
          Le Premier Marché d'Enchères Inversées Agricoles en Algérie
        </h1>
        <p className="hero-subtitle">
          Acheteurs, exprimez vos besoins en gros. Producteurs, proposez vos prix et remportez des contrats en temps réel. Simple, direct et transparent.
        </p>
        <div className="hero-cta">
          <button onClick={onNavigateToLogin} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
            Rejoindre la Plateforme
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="stats-bar glass-panel">
        <div className="stat-item">
          <div className="stat-number">50k+ Tonnes</div>
          <div className="stat-label">Produits échangés</div>
        </div>
        <div className="stat-item" style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '0 40px' }}>
          <div className="stat-number">DA 0</div>
          <div className="stat-label">Frais de commission</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">100% Direct</div>
          <div className="stat-label">Producteur à Acheteur</div>
        </div>
      </div>

      {/* Features Grid */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Comment ça fonctionne ?</h2>
          <p style={{ color: 'var(--text-muted)' }}>Découvrez les avantages de la négociation directe en temps réel</p>
        </div>

        <div className="features-grid">
          {/* Card 1: Buyers */}
          <div className="glass-panel feature-card">
            <div className="feature-icon-box">
              <ShoppingBag size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Acheteurs : Publiez vos besoins</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Exprimez vos demandes d'achats en gros. Indiquez la quantité, le prix cible maximum et joignez des photos de référence pour guider les producteurs.
            </p>
          </div>

          {/* Card 2: Producers */}
          <div className="glass-panel feature-card">
            <div className="feature-icon-box">
              <Tractor size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Producteurs : Proposez vos prix</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Parcourez les offres actives des acheteurs de toutes les Wilayas. Faites vos offres de prix en Dinars Algériens (DA) et ajustez vos tarifs selon la concurrence.
            </p>
          </div>

          {/* Card 3: Real-time */}
          <div className="glass-panel feature-card">
            <div className="feature-icon-box">
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>En Temps Réel (Sockets)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Grâce aux technologies WebSocket, les offres et validations s'affichent instantanément sans rafraîchir la page, vous offrant une réactivité maximale.
            </p>
          </div>

          {/* Card 4: Photos */}
          <div className="glass-panel feature-card">
            <div className="feature-icon-box">
              <Image size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px' }}>Galerie Photo Transparente</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Les acheteurs peuvent ajouter plusieurs clichés de la qualité attendue. Les producteurs visualisent instantanément les photos pour chiffrer l'offre au plus juste.
            </p>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section style={{ 
        maxWidth: '800px', 
        margin: '60px auto 100px auto', 
        padding: '40px', 
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05))',
        border: '1px solid var(--border)',
        borderRadius: '16px'
      }}>
        <Sprout size={40} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.75rem', marginBottom: '12px' }}>Prêt à moderniser vos transactions ?</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '1rem' }}>
          Connectez-vous pour tester le système d'enchères inversées instantané.
        </p>
        <button onClick={onNavigateToLogin} className="btn btn-primary" style={{ padding: '12px 24px' }}>
          Accéder à la connexion
        </button>
      </section>
    </div>
  );
}
