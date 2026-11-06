import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { MapView } from '../components/MapView.jsx';
import { api } from '../lib/api.js';
import { blobToBase64, resizePhoto } from '../lib/photo.js';
import { PageHero } from './PageHero.jsx';

// Must match server/reports.js. Kept here as plain lists so the UI can render
// translated labels for each value.
const ISSUES = ['overflowing', 'contaminated', 'damaged', 'missing', 'other'];
const BIN_TYPES = ['recycling', 'ewaste', 'textile', 'general', 'unknown'];
const ISSUE_COLORS = { overflowing: '#ffad67', contaminated: '#f18b78', damaged: '#91c3ed', missing: '#c7a6f0', other: '#d6d9cf' };

export function ReportPage({ geo }) {
  const { lang, t } = useI18n();
  const [reports, setReports] = useState([]);
  const [listKey, setListKey] = useState('');
  const [issue, setIssue] = useState('');
  const [binType, setBinType] = useState('recycling');
  const [pin, setPin] = useState(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const [statusKey, setStatusKey] = useState('');
  const photoInput = useRef(null);

  async function loadReports() {
    try {
      const res = await api('/api/reports');
      if (!res.ok) { setListKey('report.loadFailed'); return; }
      setReports(res.data?.reports || []); setListKey('');
    } catch { setListKey('report.loadFailed'); }
  }
  useEffect(() => { loadReports(); }, []);
  // "Use my location" drops the pin where the person is standing.
  useEffect(() => { if (geo.position) setPin(geo.position); }, [geo.position]);

  async function submit(event) {
    event.preventDefault();
    if (!issue) { setStatusKey('report.needIssue'); return; }
    if (!pin) { setStatusKey('report.needPin'); return; }
    setSending(true); setStatusKey('report.sending');
    try {
      // Small JPEG: enough to see the bin, fast on mobile data, strips EXIF/GPS.
      const photoData = photo ? await blobToBase64(await resizePhoto(photo, 1024, 0.75)) : undefined;
      const res = await api('/api/reports', { method: 'POST', body: { issue, binType, lat: pin.lat, lng: pin.lng, note, photo: photoData } });
      if (!res.ok) { setStatusKey(res.status === 429 ? 'report.tooMany' : 'report.failed'); return; }
      setStatusKey('report.sent');
      setIssue(''); setNote(''); setPhoto(null); setPin(null);
      if (photoInput.current) photoInput.current.value = '';
      await loadReports();
    } catch {
      setStatusKey('report.failed');
    } finally {
      setSending(false);
    }
  }

  const formatDate = ms => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-SG' : `${lang}-SG`, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
  const points = reports.map(r => ({
    id: r.id, lat: r.lat, lng: r.lng, color: ISSUE_COLORS[r.issue],
    popup: <><b>{t(`report.issue.${r.issue}`)}</b> · {t(`report.bin.${r.binType}`)}<br />{r.note}{r.photoUrl && <><br /><a href={r.photoUrl} target="_blank" rel="noreferrer">{t('report.viewPhoto')}</a></>}</>,
  }));

  return <>
    <PageHero eyebrow={t('report.eyebrow')} title1={t('report.title1')} title2={t('report.title2')} text={t('report.intro')} />
    <section className="guide-panel">
      <div className="report-layout">
        <form className="report-form" onSubmit={submit}>
          <h3>{t('report.formTitle')}</h3>
          <fieldset><legend>{t('report.issue')}</legend>
            <div className="issue-chips">{ISSUES.map(id => <button type="button" key={id} className={issue === id ? 'active' : ''} aria-pressed={issue === id} onClick={() => setIssue(id)}>{t(`report.issue.${id}`)}</button>)}</div>
          </fieldset>
          <label>{t('report.binType')}<select value={binType} onChange={e => setBinType(e.target.value)}>{BIN_TYPES.map(id => <option key={id} value={id}>{t(`report.bin.${id}`)}</option>)}</select></label>
          <div className="report-where"><b>{t('report.where')}</b><p className="source-note">{t('report.whereHint')}</p>
            <p className="pin-status">{pin ? t('report.pinSet', { lat: pin.lat.toFixed(4), lng: pin.lng.toFixed(4) }) : t('report.noPin')}{geo.geoKey ? ` · ${t(geo.geoKey)}` : ''}</p>
            <button type="button" className="location-button" onClick={geo.locate}>{t('nearby.useLocation')}</button>
          </div>
          <label>{t('report.note')}<textarea value={note} maxLength={200} rows={3} placeholder={t('report.notePlaceholder')} onChange={e => setNote(e.target.value)} /></label>
          <label>{t('report.photo')}<input ref={photoInput} type="file" accept="image/*" capture="environment" onChange={e => setPhoto(e.target.files[0] || null)} /></label>
          <p className="report-warning">{t('report.photoWarning')}</p>
          <button className="confirm" disabled={sending}>{sending ? t('report.sending') : t('report.submit')}</button>
          {statusKey && <p className="community-status" role="status">{t(statusKey)}</p>}
        </form>
        <div className="report-map">
          <MapView points={points} pin={pin} pinLabel={t('report.newPin')} onMapClick={setPin} you={geo.position} youLabel={t('map.you')} focus={geo.position} />
        </div>
      </div>
      <div className="report-list">
        <h3>{t('report.recent')}</h3>
        {listKey && <p className="source-note">{t(listKey)}</p>}
        {!reports.length && !listKey && <p className="source-note">{t('report.none')}</p>}
        {reports.map(r => <article key={r.id} className="report-item">
          <span className="report-dot" style={{ background: ISSUE_COLORS[r.issue] }} />
          <div><b>{t(`report.issue.${r.issue}`)}</b> · {t(`report.bin.${r.binType}`)}<small>{formatDate(r.createdAt)}</small>{r.note && <p>{r.note}</p>}</div>
          {r.photoUrl && <a href={r.photoUrl} target="_blank" rel="noreferrer">{t('report.viewPhoto')}</a>}
        </article>)}
      </div>
    </section>
  </>;
}
