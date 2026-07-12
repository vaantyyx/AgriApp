import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useTranslation } from './LanguageContext.jsx';

function Probe() {
  const { locale, setLocale, t, dir } = useTranslation();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="appName">{t('appName')}</span>
      <span data-testid="withReplacement">{t('unreadNotifications', { count: 3 })}</span>
      <span data-testid="missingKey">{t('this_key_does_not_exist')}</span>
      <button onClick={() => setLocale('en')}>switch-to-en</button>
      <button onClick={() => setLocale('not-a-real-locale')}>switch-to-invalid</button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('defaults to Arabic (rtl) when nothing is stored', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl');
  });

  test('t() resolves a real key to non-empty, locale-specific text', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('appName').textContent).not.toBe('');
    expect(screen.getByTestId('appName').textContent).not.toBe('appName');
  });

  test('t() substitutes {placeholders} from the replacements object', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('withReplacement').textContent).toContain('3');
  });

  test('t() falls back to returning the raw key when no translation exists', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('missingKey')).toHaveTextContent('this_key_does_not_exist');
  });

  test('setLocale switches locale and flips dir to ltr for English', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    fireEvent.click(screen.getByText('switch-to-en'));
    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr');
    expect(localStorage.getItem('sougra_lang')).toBe('en');
  });

  test('setLocale ignores an unsupported locale (stays on the current one)', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    fireEvent.click(screen.getByText('switch-to-invalid'));
    expect(screen.getByTestId('locale')).toHaveTextContent('ar');
  });
});
