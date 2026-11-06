import { useState } from 'react';
import { api, errorKeyFor } from '../lib/api.js';

export function useChat({ lang, t }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    const message = text.trim();
    if (!message || busy) return;
    const next = [...messages, { role: 'user', text: message }];
    setMessages(next); setText(''); setBusy(true);
    try {
      const res = await api('/api/text-analyze', { method: 'POST', body: {
        language: lang,
        messages: next.filter(m => !m.error).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.text })),
      } });
      const reply = res.ok ? { role: 'assistant', text: res.data?.reply || '' } : { role: 'assistant', text: t(errorKeyFor(res.status, 'err.chat')), error: true };
      setMessages([...next, reply].slice(-12));
    } catch {
      setMessages([...next, { role: 'assistant', text: t('err.network'), error: true }].slice(-12));
    } finally {
      setBusy(false);
    }
  }
  return { messages, text, setText, busy, ask };
}
