import React, { useState, useEffect } from 'react';
import { Shield, Key, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';

const secTrans = {
  fr: {
    twoFactorTitle: "Double authentification (2FA)",
    twoFactorDesc: "Ajoutez une couche de sécurité supplémentaire à votre compte. Lors de la connexion, vous devrez saisir un code envoyé par e-mail.",
    enable2FA: "Activer la double authentification",
    saveSecurityBtn: "Enregistrer les paramètres de sécurité",
    securitySaveSuccess: "Paramètres de sécurité mis à jour.",
    changePasswordTitle: "Changer le mot de passe",
    changePasswordDesc: "Pour modifier votre mot de passe, vous devez d'abord saisir votre mot de passe actuel pour recevoir un code de vérification.",
    currentPasswordLabel: "Mot de passe actuel",
    newPasswordLabel: "Nouveau mot de passe",
    confirmNewPasswordLabel: "Confirmer le nouveau mot de passe",
    requestOtpBtn: "Demander le code OTP",
    requestingOtp: "Demande en cours...",
    otpSentSuccess: "Un code OTP a été envoyé. Il est valide pendant 10 minutes.",
    otpCodeLabel: "Code de vérification (OTP)",
    otpCodePlaceholder: "Code à 6 chiffres",
    changePasswordBtn: "Confirmer le changement",
    changingPassword: "Modification en cours...",
    passwordChangeSuccess: "Mot de passe modifié avec succès.",
    passwordsMismatch: "Les nouveaux mots de passe ne correspondent pas.",
    otpInvalidLength: "Veuillez saisir un code OTP à 6 chiffres.",
    passwordTooShort: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
    updateError: "Erreur lors de la mise à jour.",
    serverError: "Erreur serveur. Veuillez réessayer.",
    dangerZoneTitle: "Zone de danger",
    dangerZoneDesc: "La désactivation de votre compte le désactivera. Vous ne pourrez plus vous connecter ni utiliser la plateforme jusqu'à sa réactivation.",
    deactivateBtn: "Désactiver le compte",
    deactivateConfirmTitle: "Confirmer la désactivation",
    deactivateConfirmDesc: "Êtes-vous sûr de vouloir désactiver votre compte ? Cette action n'est pas facilement réversible.",
    cancelBtn: "Annuler",
    deactivatingBtn: "Désactivation...",
    deactivateSuccess: "Compte désactivé avec succès.",
  },
  ar: {
    twoFactorTitle: "التحقق المزدوج (2FA)",
    twoFactorDesc: "أضف طبقة أمان إضافية لحسابك. عند تسجيل الدخول، ستحتاج إلى إدخال رمز مرسل عبر البريد الإلكتروني.",
    enable2FA: "تفعيل التحقق المزدوج",
    saveSecurityBtn: "حفظ إعدادات الأمان",
    securitySaveSuccess: "تم تحديث إعدادات الأمان بنجاح.",
    changePasswordTitle: "تغيير كلمة المرور",
    changePasswordDesc: "لتغيير كلمة المرور الخاصة بك، يجب عليك أولاً إدخال كلمة المرور الحالية لتلقي رمز التحقق.",
    currentPasswordLabel: "كلمة المرور الحالية",
    newPasswordLabel: "كلمة المرور الجديدة",
    confirmNewPasswordLabel: "تأكيد كلمة المرور الجديدة",
    requestOtpBtn: "طلب رمز التحقق (OTP)",
    requestingOtp: "جاري الطلب...",
    otpSentSuccess: "تم إرسال رمز التحقق. الرمز صالح لمدة 10 دقائق.",
    otpCodeLabel: "رمز التحقق (OTP)",
    otpCodePlaceholder: "رمز من 6 أرقام",
    changePasswordBtn: "تأكيد التغيير",
    changingPassword: "جاري التعديل...",
    passwordChangeSuccess: "تم تغيير كلمة المرور بنجاح.",
    passwordsMismatch: "كلمتا المرور الجديدتان غير متطابقتين.",
    otpInvalidLength: "يرجى إدخال رمز تحقق مكون من 6 أرقام.",
    passwordTooShort: "يجب أن تحتوي كلمة المرور الجديدة على 8 أحرف على الأقل.",
    updateError: "خطأ أثناء التحديث.",
    serverError: "خطأ في الخادم. يرجى المحاولة مرة أخرى.",
    dangerZoneTitle: "منطقة الخطر",
    dangerZoneDesc: "سيؤدي إلغاء تنشيط حسابك إلى تعطيله. لن تتمكن من تسجيل الدخول أو استخدام المنصة حتى يتم إعادة تنشيطه.",
    deactivateBtn: "إلغاء تنشيط الحساب",
    deactivateConfirmTitle: "تأكيد إلغاء التنشيط",
    deactivateConfirmDesc: "هل أنت متأكد أنك تريد إلغاء تنشيط حسابك؟ هذا الإجراء لا يمكن التراجع عنه بسهولة.",
    cancelBtn: "إلغاء",
    deactivatingBtn: "جاري...",
    deactivateSuccess: "تم إلغاء تنشيط الحساب بنجاح.",
  },
  en: {
    twoFactorTitle: "Two-Factor Authentication (2FA)",
    twoFactorDesc: "Add an extra layer of security to your account. Upon logging in, you will be required to enter a code sent via email.",
    enable2FA: "Enable Two-Factor Authentication",
    saveSecurityBtn: "Save Security Settings",
    securitySaveSuccess: "Security settings updated successfully.",
    changePasswordTitle: "Change Password",
    changePasswordDesc: "To modify your password, you must first enter your current password to receive a verification code.",
    currentPasswordLabel: "Current Password",
    newPasswordLabel: "New Password",
    confirmNewPasswordLabel: "Confirm New Password",
    requestOtpBtn: "Request OTP Code",
    requestingOtp: "Requesting...",
    otpSentSuccess: "An OTP code has been sent. It is valid for 10 minutes.",
    otpCodeLabel: "Verification Code (OTP)",
    otpCodePlaceholder: "6-digit code",
    changePasswordBtn: "Confirm Change",
    changingPassword: "Changing...",
    passwordChangeSuccess: "Password changed successfully.",
    passwordsMismatch: "The new passwords do not match.",
    otpInvalidLength: "Please enter a 6-digit OTP code.",
    passwordTooShort: "The new password must be at least 8 characters long.",
    updateError: "Update error.",
    serverError: "Server error. Please try again.",
    dangerZoneTitle: "Danger Zone",
    dangerZoneDesc: "Deactivating your account will disable it. You will not be able to log in or use the platform until it is reactivated.",
    deactivateBtn: "Deactivate account",
    deactivateConfirmTitle: "Confirm deactivation",
    deactivateConfirmDesc: "Are you sure you want to deactivate your account? This action is not easily reversible.",
    cancelBtn: "Cancel",
    deactivatingBtn: "Deactivating...",
    deactivateSuccess: "Account deactivated successfully.",
  }
};

export default function SecuritySettingsTab({ token, profile, setProfile, onUserUpdate, showToast, onLogout, initialUser }) {
  const { t, locale, dir } = useTranslation();
  const secT = secTrans[locale] || secTrans.fr;

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [showPasswordCurrent, setShowPasswordCurrent] = useState(false);
  const [showPasswordNew, setShowPasswordNew] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (profile) {
      setTwoFactorEnabled(!!profile.two_factor_enabled);
    }
  }, [profile]);

  const handleSaveSecuritySettings = async () => {
    setSavingSecurity(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ two_factor_enabled: twoFactorEnabled }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(secT.securitySaveSuccess);
        setProfile(prev => ({ ...prev, two_factor_enabled: twoFactorEnabled }));
        if (onUserUpdate && data.user) onUserUpdate({ ...initialUser, ...data.user });
      } else {
        showToast(data.error || secT.updateError, 'error');
      }
    } catch {
      showToast(secT.serverError, 'error');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleRequestPasswordOtp = async () => {
    if (!currentPassword) return;
    setRequestingOtp(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/password/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, locale }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(secT.otpSentSuccess);
        setOtpRequested(true);
      } else {
        showToast(data.error || secT.updateError, 'error');
      }
    } catch {
      showToast(secT.serverError, 'error');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleChangePasswordSubmit = async () => {
    if (!otpCode || otpCode.length !== 6) { showToast(secT.otpInvalidLength, 'error'); return; }
    if (newPassword.length < 8) { showToast(secT.passwordTooShort, 'error'); return; }
    if (newPassword !== confirmNewPassword) { showToast(secT.passwordsMismatch, 'error'); return; }
    setChangingPassword(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/password/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, otp: otpCode, password: newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(secT.passwordChangeSuccess);
        setCurrentPassword(''); setOtpCode(''); setNewPassword(''); setConfirmNewPassword(''); setOtpRequested(false);
      } else {
        showToast(data.error || secT.updateError, 'error');
      }
    } catch {
      showToast(secT.serverError, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    setDeactivating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(secT.deactivateSuccess);
        setShowDeactivateModal(false);
        onLogout();
      } else {
        showToast(data.error || secT.serverError, 'error');
      }
    } catch {
      showToast(secT.serverError, 'error');
    } finally {
      setDeactivating(false);
    }
  };

  const spinner = <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Card 1: 2FA */}
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'start' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <Shield size={20} style={{ color: 'var(--primary)' }} />
          <span>{secT.twoFactorTitle}</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: '1.5' }}>{secT.twoFactorDesc}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            <button type="button" onClick={() => setTwoFactorEnabled(!twoFactorEnabled)} style={{ position: 'relative', width: '48px', height: '24px', borderRadius: '12px', background: twoFactorEnabled ? 'var(--primary)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'background-color 0.3s ease', padding: 0, outline: 'none' }}>
              <div style={{ position: 'absolute', top: '3px', left: twoFactorEnabled ? '27px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>{secT.enable2FA}</span>
          </div>
          <div>
            <button onClick={handleSaveSecuritySettings} disabled={savingSecurity} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.875rem' }}>
              {savingSecurity ? spinner : <Save size={14} />}
              {secT.saveSecurityBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Change Password */}
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'start' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <Key size={20} style={{ color: 'var(--primary)' }} />
          <span>{secT.changePasswordTitle}</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: '1.5' }}>{secT.changePasswordDesc}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '450px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>{secT.currentPasswordLabel}</label>
            <div style={{ position: 'relative' }}>
              <input type={showPasswordCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={otpRequested} style={{ width: '100%', paddingLeft: dir === 'ltr' ? '40px' : '16px', paddingRight: dir === 'rtl' ? '40px' : '16px', textAlign: 'start' }} />
              <Lock size={15} style={{ position: 'absolute', left: dir === 'ltr' ? '12px' : 'auto', right: dir === 'rtl' ? '12px' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              {!otpRequested && (
                <button type="button" onClick={() => setShowPasswordCurrent(!showPasswordCurrent)} aria-label={showPasswordCurrent ? t('hidePasswordLabel') : t('showPasswordLabel')} style={{ position: 'absolute', right: dir === 'ltr' ? '12px' : 'auto', left: dir === 'rtl' ? '12px' : 'auto', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                  {showPasswordCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              )}
            </div>
          </div>
          {!otpRequested ? (
            <div>
              <button onClick={handleRequestPasswordOtp} disabled={requestingOtp || !currentPassword} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {requestingOtp ? spinner : null}
                {requestingOtp ? secT.requestingOtp : secT.requestOtpBtn}
              </button>
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--primary)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <CheckCircle size={15} />
                <span>{secT.otpSentSuccess}</span>
                <button onClick={() => { setOtpRequested(false); setOtpCode(''); setNewPassword(''); setConfirmNewPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline', marginStart: 'auto' }}>
                  {locale === 'fr' ? 'Recommencer' : (locale === 'ar' ? 'إعادة المحاولة' : 'Restart')}
                </button>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{secT.otpCodeLabel}</label>
                <input type="text" maxLength={6} placeholder={secT.otpCodePlaceholder} value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} style={{ width: '100%', textAlign: 'center', fontSize: '1.25rem', letterSpacing: '4px', fontWeight: 'bold' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{secT.newPasswordLabel}</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPasswordNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', paddingLeft: dir === 'ltr' ? '40px' : '16px', paddingRight: dir === 'rtl' ? '40px' : '16px', textAlign: 'start' }} />
                  <Lock size={15} style={{ position: 'absolute', left: dir === 'ltr' ? '12px' : 'auto', right: dir === 'rtl' ? '12px' : 'auto', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <button type="button" onClick={() => setShowPasswordNew(!showPasswordNew)} aria-label={showPasswordNew ? t('hidePasswordLabel') : t('showPasswordLabel')} style={{ position: 'absolute', right: dir === 'ltr' ? '12px' : 'auto', left: dir === 'rtl' ? '12px' : 'auto', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}>
                    {showPasswordNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>{secT.confirmNewPasswordLabel}</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} style={{ width: '100%', textAlign: 'start' }} />
              </div>
              <div>
                <button onClick={handleChangePasswordSubmit} disabled={changingPassword || !otpCode || !newPassword || !confirmNewPassword} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {changingPassword ? spinner : null}
                  {changingPassword ? secT.changingPassword : secT.changePasswordBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Danger Zone */}
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'start', border: '1px solid rgba(239,68,68,0.3)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
          <AlertCircle size={20} />
          <span>{secT.dangerZoneTitle}</span>
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '20px', lineHeight: '1.5' }}>
          {secT.dangerZoneDesc}
        </p>
        <button onClick={() => setShowDeactivateModal(true)} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.875rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>
          {secT.deactivateBtn}
        </button>
      </div>

      {/* Deactivation Confirmation Modal */}
      {showDeactivateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" role="dialog" aria-modal="true" aria-label={secT.deactivateConfirmTitle} style={{ maxWidth: '420px', width: '90%', padding: '28px', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', marginBottom: '16px' }}>
              <AlertCircle size={28} style={{ color: '#ef4444' }} />
            </div>
            <h3 style={{ color: '#ef4444', margin: '0 0 8px', fontSize: '1.2rem' }}>{secT.deactivateConfirmTitle}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
              {secT.deactivateConfirmDesc}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setShowDeactivateModal(false)} className="btn" style={{ padding: '10px 24px', fontSize: '0.875rem', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
                {secT.cancelBtn}
              </button>
              <button onClick={handleDeactivateConfirm} disabled={deactivating} style={{ padding: '10px 24px', fontSize: '0.875rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: deactivating ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {deactivating ? spinner : null}
                {deactivating ? secT.deactivatingBtn : secT.deactivateConfirmTitle}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
