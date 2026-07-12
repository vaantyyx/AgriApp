import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';
import LoginPage from './LoginPage';

// Default locale (no localStorage) is Arabic — see LanguageContext.test.jsx.
const FIELDS_REQUIRED_AR = 'يرجى ملء جميع الحقول.';
const CAPTCHA_REQUIRED_AR = 'يرجى إكمال التحقق الأمني قبل المتابعة.';

function renderLoginPage(props = {}) {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <ThemeProvider>
          <LoginPage onLoginSuccess={vi.fn()} onNavigateToRegister={vi.fn()} {...props} />
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.reject(new Error('fetch should not have been called in this test'))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('blocks submission and shows an error when email/password are empty', async () => {
    renderLoginPage();

    fireEvent.submit(document.querySelector('form'));

    await waitFor(() => {
      expect(screen.getByText(FIELDS_REQUIRED_AR)).toBeInTheDocument();
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('blocks submission with a captcha-required error when the captcha has not been solved', async () => {
    renderLoginPage();

    fireEvent.change(document.getElementById('login-email'), { target: { value: 'test@example.com' } });
    fireEvent.change(document.getElementById('login-password'), { target: { value: 'somePassword123' } });

    fireEvent.submit(document.querySelector('form'));

    // The real CaptchaGrid is rendered but unsolved (verified=false by
    // default), so captchaRef.current.getToken() returns null and
    // handleSubmit must bail out before ever calling fetch.
    await waitFor(() => {
      expect(screen.getByText(CAPTCHA_REQUIRED_AR)).toBeInTheDocument();
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
