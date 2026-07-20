import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { BACKEND_URL } from '../utils/config.js';

function getStoredToken() {
  try { return sessionStorage.getItem('agri_token') || null; } catch { return null; }
}

export default function AiAssistant() {
  const { t, dir, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const token = getStoredToken();
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: nextMessages.slice(-20), locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('aiAssistantError'));
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message || t('aiAssistantError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="ai-assistant-fab"
        title={t('aiAssistantButtonLabel')}
        aria-label={t('aiAssistantButtonLabel')}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {open && (
        <div className="ai-assistant-panel" style={{ direction: dir }}>
          <div className="ai-assistant-header">
            <div className="ai-assistant-header-title">
              <Sparkles size={16} />
              <span>{t('aiAssistantTitle')}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="ai-assistant-close-btn" aria-label={t('aiAssistantClose')}>
              <X size={16} />
            </button>
          </div>

          <div className="ai-assistant-messages">
            {messages.length === 0 && (
              <div className="ai-assistant-msg assistant" dir="auto">{t('aiAssistantGreeting')}</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-assistant-msg ${m.role}`} dir="auto">{m.content}</div>
            ))}
            {loading && (
              <div className="ai-assistant-msg assistant ai-assistant-typing">
                <span></span><span></span><span></span>
              </div>
            )}
            {error && <div className="ai-assistant-msg-error">{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          <form className="ai-assistant-input-row" onSubmit={sendMessage}>
            <input
              type="text"
              dir="auto"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('aiAssistantPlaceholder')}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label={t('aiAssistantSend')}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
