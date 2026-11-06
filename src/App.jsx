import { useEffect, useState } from 'react';
import items from './data/items.json';
import { LANGUAGES, useI18n } from './i18n/index.jsx';
import { readLocalArray, writeLocal } from './lib/storage.js';
import { useScan } from './hooks/useScan.js';
import { useGeolocation, useNearby } from './hooks/useNearby.js';
import { useChat } from './hooks/useChat.js';
import { ScanPage } from './pages/ScanPage.jsx';
import { NearbyPage } from './pages/NearbyPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { GuidePage } from './pages/GuidePage.jsx';
import { CommunityPage } from './pages/CommunityPage.jsx';

const PAGES = ['scan', 'nearby', 'report', 'guide', 'community'];
const itemsById = new Map(items.map(item => [item.id, item]));

// App is the shell: header, navigation, language picker and footer. State
// that must survive switching tabs (scan results, chat, nearby search) lives
// in hooks owned here; each page component only renders.
export default function App() {
  const { lang, setLang, t } = useI18n();
  const [page, setPage] = useState('scan');
  const [guideId, setGuideId] = useState(items[0].id);
  const [history, setHistory] = useState(() => readLocalArray('binsense-history'));
  const [scores, setScores] = useState(() => readLocalArray('binsense-community-scores'));
  const [server, setServer] = useState({ checked: false, ready: false });
  const geo = useGeolocation();
  const nearby = useNearby(geo.position);
  const chat = useChat({ lang, t });
  const scan = useScan({
    itemsById, lang,
    onItemsFound(found) {
      setGuideId(found[0].item_id);
      const unique = [...new Map(found.map(d => [d.item_id, d.item])).values()];
      setHistory(current => [...unique.map(item => ({ id: item.id, emoji: item.emoji, name: item.name, time: Date.now() })), ...current].slice(0, 20));
    },
  });

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(data => setServer({ checked: true, ready: Boolean(data.ready) }))
      .catch(() => setServer({ checked: true, ready: false, down: true }));
  }, []);
  useEffect(() => { writeLocal('binsense-history', history.slice(0, 20)); }, [history]);
  useEffect(() => { writeLocal('binsense-community-scores', scores.slice(0, 100)); }, [scores]);

  function go(next) { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function openNearby(category) { go('nearby'); nearby.load(category); }
  const footerKey = !server.checked ? '' : server.down ? 'footer.serverDown' : server.ready ? 'footer.ready' : 'footer.notReady';

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-icon">↗</span>BinSense<em>{t('brand.tagline')}</em></div>
      <nav className="nav" aria-label="Main navigation">{PAGES.map(id => <button type="button" key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>{t(`nav.${id}`)}</button>)}</nav>
      <label className="lang-picker"><span className="sr-only">{t('lang.label')}</span>🌐
        <select value={lang} onChange={e => setLang(e.target.value)} aria-label={t('lang.label')}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
      </label>
    </header>
    {page === 'scan' && <ScanPage scan={scan} chat={chat} items={items} guideId={guideId} setGuideId={setGuideId} geminiReady={server.ready} history={history} clearHistory={() => setHistory([])} onNearby={openNearby} />}
    {page === 'nearby' && <NearbyPage nearby={nearby} geo={geo} />}
    {page === 'report' && <ReportPage geo={geo} />}
    {page === 'guide' && <GuidePage items={items} />}
    {page === 'community' && <CommunityPage scores={scores} setScores={setScores} />}
    <footer className="foot"><span>{footerKey && t(footerKey)}</span><span>{t('footer.privacy')}</span></footer>
  </main>;
}
