import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { FILTERS, NOT_LISTED, badgeKey, conditionAdviceKey, countByGroup, filterDetections } from '../lib/sorting.js';

// Draws numbered boxes over the photo preview.
// The <img> uses object-fit: contain, so the visible picture can be letterboxed.
// An SVG with viewBox = the image's natural size and preserveAspectRatio
// "xMidYMid meet" scales exactly the same way, so boxes line up at any size.
export function DetectionOverlay({ detections, size, activeNumber, onHover }) {
  if (!size || !detections.length) return null;
  const { width: w, height: h } = size;
  const badge = Math.max(w, h) * 0.035;
  return <svg className="detection-overlay" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    {detections.filter(d => d.box).map(d => {
      const x = d.box.left * w, y = d.box.top * h;
      const active = activeNumber === d.number;
      return <g key={d.number} className={`box ${d.group} ${active ? 'active' : ''}`} onMouseEnter={() => onHover(d.number)} onMouseLeave={() => onHover(null)}>
        <rect x={x} y={y} width={(d.box.right - d.box.left) * w} height={(d.box.bottom - d.box.top) * h} rx={badge * 0.25} vectorEffect="non-scaling-stroke" />
        <circle cx={x + badge * 0.6} cy={y + badge * 0.6} r={badge * 0.55} />
        <text x={x + badge * 0.6} y={y + badge * 0.6} fontSize={badge * 0.7} textAnchor="middle" dominantBaseline="central">{d.number}</text>
      </g>;
    })}
  </svg>;
}

function CorrectionPicker({ detection, items, onPick, onCancel }) {
  const { t, localizeItem } = useI18n();
  return <div className="correction">
    <label>{t('det.whatIsIt')}
      <select defaultValue="" onChange={e => e.target.value && onPick(e.target.value)} autoFocus>
        <option value="" disabled>—</option>
        {items.filter(item => item.id !== detection.item_id).map(item => { const l = localizeItem(item); return <option key={item.id} value={item.id}>{l.emoji} {l.name}</option>; })}
        <option value={NOT_LISTED}>{t('det.notListed')}</option>
      </select>
    </label>
    <button type="button" className="link-btn" onClick={onCancel}>{t('det.cancel')}</button>
  </div>;
}

export function DetectionResults({ detections, items, filter, onFilter, activeNumber, onHover, onSelect, selectedId, onCorrect, feedbackKey }) {
  const { t, tn, localizeItem } = useI18n();
  const [correcting, setCorrecting] = useState(null);
  if (!detections.length) return null;
  const counts = countByGroup(detections);
  const prepCount = detections.filter(d => conditionAdviceKey(d)).length;
  // If a correction empties the chosen filter, fall back to showing everything.
  const activeFilter = filter !== 'all' && !counts[filter] ? 'all' : filter;
  const visible = filterDetections(detections, activeFilter);
  const countFor = id => (id === 'all' ? detections.length : counts[id]);
  return <div className="detections">
    <p className="detected-count">{tn('det.found', detections.length)}</p>
    {counts.rubbish > 0 && <div className="sort-alert rubbish" role="alert">{tn('det.rubbish', counts.rubbish)}</div>}
    {counts.special > 0 && <div className="sort-alert special">{tn('det.special', counts.special)}</div>}
    {prepCount > 0 && <div className="sort-alert prep">{tn('det.prep', prepCount)}</div>}
    <div className="filter-chips" role="group" aria-label={t('det.filterLabel')}>
      {FILTERS.filter(id => id !== 'unknown' || counts.unknown).map(id => <button key={id} type="button" className={activeFilter === id ? 'active' : ''} aria-pressed={activeFilter === id} disabled={id !== 'all' && !counts[id]} onClick={() => onFilter(id)}>{t(`filter.${id}`)} <span>{countFor(id)}</span></button>)}
    </div>
    <ul className="detection-list">
      {visible.map(d => {
        const item = localizeItem(d.item);
        const advice = conditionAdviceKey(d);
        return <li key={d.number} className={`detection-row ${d.group}`}>
          <button type="button" className={`detection ${d.group} ${activeNumber === d.number ? 'active' : ''} ${d.item && selectedId === d.item_id ? 'selected' : ''}`}
            onMouseEnter={() => onHover(d.number)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(d.number)} onBlur={() => onHover(null)}
            onClick={() => d.item && onSelect(d)}>
            <span className="detection-number">{d.number}</span>
            <span className="detection-text">
              <strong>{item ? `${item.emoji} ${item.name}` : `❓ ${t('det.notInGuide')}`}</strong>
              <small>{d.label || t('det.inPhoto')}{d.box ? '' : ` · ${t('det.noBox')}`}{d.corrected ? ` · ${t('det.corrected')}` : ''}</small>
            </span>
            <span className={`disposal-badge ${d.group}`}>{t(badgeKey(d.item))}</span>
          </button>
          {advice && <p className="condition-advice">🧽 {t(advice)}</p>}
          {correcting === d.number
            ? <CorrectionPicker detection={d} items={items} onCancel={() => setCorrecting(null)} onPick={id => { setCorrecting(null); onCorrect(d, id); }} />
            : <button type="button" className="link-btn wrong-btn" onClick={() => setCorrecting(d.number)}>{t('det.wrong')}</button>}
        </li>;
      })}
    </ul>
    {feedbackKey && <p className="source-note" role="status">{t(feedbackKey)}</p>}
  </div>;
}
