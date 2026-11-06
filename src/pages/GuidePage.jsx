import { useI18n } from '../i18n/index.jsx';
import { PageHero } from './PageHero.jsx';

const TILES = [['♻️', 'blue'], ['🌱', 'food'], ['🗑️', 'general'], ['🔋', 'ewaste'], ['🧺', 'textile'], ['💰', 'bcrs']];

export function GuidePage({ items }) {
  const { t, localizeItem } = useI18n();
  return <>
    <PageHero eyebrow={t('quick.eyebrow')} title1={t('quick.title1')} title2={t('quick.title2')} text={t('quick.intro')} />
    <div className="guide-grid">{TILES.map(([icon, key]) => <article className="guide-tile" key={key}><span className="gicon">{icon}</span><h3>{t(`quick.${key}.title`)}</h3><p>{t(`quick.${key}.text`)}</p></article>)}</div>
    <div className="guide-list"><h2>{t('quick.items')}</h2>{items.map(base => { const item = localizeItem(base); return <details key={item.id}><summary>{item.emoji} {item.name}</summary><p>{item.answer}: {item.instruction}</p><small>{item.source}</small></details>; })}</div>
  </>;
}
