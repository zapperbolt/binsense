import { useI18n } from '../i18n/index.jsx';
import { MapView } from '../components/MapView.jsx';
import { PageHero } from './PageHero.jsx';

const CATEGORIES = ['recycling', 'ewaste', 'textile', 'beverage'];

export function NearbyPage({ nearby, geo }) {
  const { t } = useI18n();
  const points = nearby.locations.map(loc => ({ ...loc, popup: <><b>{loc.name}</b><br />{loc.address}</> }));
  return <>
    <PageHero eyebrow={t('nearby.eyebrow')} title1={t('nearby.title1')} title2={t('nearby.title2')} text={t('nearby.intro')} />
    <section className="guide-panel">
      <div className="locator-controls">{CATEGORIES.map(id => <button type="button" key={id} className={nearby.category === id ? 'active' : ''} onClick={() => nearby.load(id)}>{t(`nearby.cat.${id}`)}</button>)}</div>
      <div className="location-head">
        <p className="location-state">{t(nearby.stateKey)}{geo.geoKey ? ` · ${t(geo.geoKey)}` : ''}</p>
        <div className="locator-actions">
          <button type="button" className="location-button" onClick={geo.locate}>{t('nearby.useLocation')}</button>
          {nearby.category === 'beverage' && <a className="locator-link" href="https://returnright.sg/p/find-my-nearest-rvm" target="_blank" rel="noreferrer">{t('nearby.openReturnRight')}</a>}
        </div>
      </div>
      <div className="locator-layout">
        <MapView points={points} you={geo.position} youLabel={t('map.you')} focus={geo.position} />
        <div className="location-results">{nearby.locations.length
          ? nearby.locations.map(loc => <article className="location-result" key={loc.id}>
            <h3>{loc.name}</h3><p>{loc.address}</p><p>{loc.accepted}</p>
            <span className="location-distance">{loc.distance == null ? t('nearby.point') : t('nearby.kmAway', { km: loc.distance.toFixed(1) })}</span><br />
            <a className="locator-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer">{t('nearby.directions')}</a>
          </article>)
          : <div className="empty-locations">{t('nearby.empty')}</div>}</div>
      </div>
    </section>
  </>;
}
