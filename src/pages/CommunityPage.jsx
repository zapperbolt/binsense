import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { PageHero } from './PageHero.jsx';

const ESTATES = ['Ang Mo Kio','Bedok','Bishan','Bukit Batok','Bukit Merah','Choa Chu Kang','Clementi','Geylang','Hougang','Jurong East','Jurong West','Kallang / Whampoa','Marine Parade','Pasir Ris','Punggol','Queenstown','Sembawang','Sengkang','Serangoon','Tampines','Toa Payoh','Woodlands','Yishun'];

export function CommunityPage({ scores, setScores }) {
  const { t } = useI18n();
  const [statusKey, setStatusKey] = useState('');
  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!String(form.get('name') || '').trim() || !form.get('estate') || !form.get('proof')?.size) { setStatusKey('community.missing'); return; }
    const row = { name: String(form.get('name')).trim(), estate: String(form.get('estate')), points: 5, status: 'pending', createdAt: Date.now() };
    setScores(current => [row, ...current].slice(0, 100));
    setStatusKey('community.submitted');
    event.currentTarget.reset();
  }
  return <>
    <PageHero eyebrow={t('community.eyebrow')} title1={t('community.title1')} title2={t('community.title2')} text={t('community.intro')} />
    <section className="guide-panel">
      <form className="community-form" onSubmit={submit}>
        <label>{t('community.name')}<input name="name" maxLength="24" placeholder={t('community.namePlaceholder')} required /></label>
        <label>{t('community.estate')}<select name="estate" required defaultValue=""><option value="" disabled>{t('community.chooseEstate')}</option>{ESTATES.map(estate => <option key={estate}>{estate}</option>)}</select></label>
        <label>{t('community.proof')}<input name="proof" type="file" accept="image/*" capture="environment" required /></label>
        <button className="confirm">{t('community.submit')}</button>
      </form>
      <p className="community-status">{statusKey && t(statusKey)}</p>
      <div className="leaderboard">
        <h3>{t('community.board')} <span className="pilot-label">{t('community.pilot')}</span></h3>
        <p className="source-note">{t('community.boardNote')}</p>
        {scores.length
          ? [...scores].sort((a, b) => b.points - a.points).slice(0, 10).map((row, i) => <div className="leaderboard-row" key={`${row.createdAt}-${i}`}><b>{i + 1}</b><span>{row.name}<small>{row.estate} · {t('community.pending')}</small></span><span className="leaderboard-points">{t('community.points', { points: row.points })}</span></div>)
          : <p className="source-note">{t('community.empty')}</p>}
      </div>
    </section>
  </>;
}
