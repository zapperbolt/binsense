import { useEffect, useState } from 'react';
import { LANGUAGES, useI18n } from '../i18n/index.jsx';
import { collectionCategoryFor } from '../lib/sorting.js';
import { findVoice, speak, stopSpeaking, watchVoices } from '../lib/speech.js';

const SYMBOLS = { recycle: '♻️', compost: '🌱', general: '🗑️', special: '🔋', textile: '🧺' };

function ReadAloud({ text }) {
  const { lang, t } = useI18n();
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => watchVoices(setVoices), []);
  // Stop talking when the text or language changes, or the guide unmounts.
  useEffect(() => () => { stopSpeaking(); setSpeaking(false); }, [text, lang]);
  const voice = findVoice(voices, LANGUAGES.find(l => l.code === lang).speech);
  if (!voice) return <button type="button" className="listen-btn" disabled title={t('guide.noVoice')}>🔇 {t('guide.noVoice')}</button>;
  return <button type="button" className="listen-btn" aria-pressed={speaking} onClick={() => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(speak(text, voice, { onEnd: () => setSpeaking(false) }));
  }}>{speaking ? `■ ${t('guide.stop')}` : `🔊 ${t('guide.listen')}`}</button>;
}

export function ItemGuide({ item: baseItem, onNearby }) {
  const { lang, t, localizeItem } = useI18n();
  const item = localizeItem(baseItem);
  const collection = collectionCategoryFor(item);
  const isDrinkContainer = item.id === 'plastic-bottle' || item.id === 'aluminium-can';
  return <section className="detected-item">
    <div className="item-heading"><div className="item-emoji">{item.emoji}</div><div><h2>{item.name}</h2><p>{item.material}</p></div></div>
    <p className="prototype-note">{t('guide.aiNote')}</p>
    <div className={`bin-answer ${item.category}`}>
      <div className="bin-symbol">{SYMBOLS[item.category]}</div>
      <div><div className="answer-label">{t(`guide.label.${item.category}`)}</div><h3 className="answer-title">{item.answer}</h3><p className="answer-description">{item.instruction}</p></div>
    </div>
    <div className="answer-actions">
      <ReadAloud text={`${item.name}. ${item.answer}. ${item.instruction}`} />
      {collection && <button type="button" onClick={() => onNearby(collection)}>{t('guide.findNearby')}</button>}
      {isDrinkContainer && <button type="button" onClick={() => onNearby('beverage')}>{t('guide.checkReturn')}</button>}
    </div>
    {isDrinkContainer && <p className="source">{t('guide.bcrs')}</p>}
    <div className="tip"><span className="tip-icon">💡</span><p><b>{t('guide.tipTitle')}</b><br />{item.tip}</p></div>
    <p className="source">{t('guide.source')} {item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.source}</a> : item.source}</p>
    {lang !== 'en' && <p className="source">{t('guide.machine')}</p>}
  </section>;
}
