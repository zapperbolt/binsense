import { useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { DetectionOverlay, DetectionResults } from '../components/PhotoDetections.jsx';
import { ItemGuide } from '../components/ItemGuide.jsx';
import { PageHero } from './PageHero.jsx';

export function ScanPage({ scan, chat, items, guideId, setGuideId, geminiReady, history, clearHistory, onNearby }) {
  const { t, localizeItem } = useI18n();
  const fileInputRef = useRef(null);
  const selected = items.find(item => item.id === guideId) || items[0];
  const pickFile = () => fileInputRef.current?.click();

  return <>
    <PageHero eyebrow={t('scan.eyebrow')} title1={t('scan.title1')} title2={t('scan.title2')} text={t('scan.intro')}>
      <div className="hero-stat"><span className="stat-icon">♻</span><div><strong>{t('scan.statTitle')}</strong><small>{t('scan.statText')}</small></div></div>
    </PageHero>
    <section className="grid">
      <div className="card scan-card">
        <div className="card-top"><span className="card-title">{t('scan.addPhoto')}</span><span className="step">{t('scan.step1')}</span></div>
        <div className={`dropzone ${scan.preview ? 'has-photo' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); scan.selectFile(e.dataTransfer.files[0]); }}>
          {scan.preview
            ? <>
              <img src={scan.preview} alt={t('scan.photoAlt')} onLoad={e => scan.setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />
              <DetectionOverlay detections={scan.detections} size={scan.imageSize} activeNumber={scan.active} onHover={scan.setActive} />
              <div className="photo-actions">
                <button type="button" className="tiny-btn" onClick={pickFile}>{t('scan.change')}</button>
                <button type="button" className="tiny-btn" onClick={scan.clearPhoto}>{t('scan.remove')}</button>
              </div>
            </>
            : <div className="upload-content"><div className="upload-icon">＋</div><strong>{t('scan.drop')}</strong><p>{t('scan.camera')}</p><button type="button" className="choose-btn" onClick={pickFile}>{t('scan.choose')}</button></div>}
          {/* Clearing value after each pick lets the same file be chosen again. */}
          <input ref={fileInputRef} id="fileInput" type="file" accept="image/*" capture="environment" onChange={e => { scan.selectFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
        <div className="step-two"><span className="step-number">2</span><strong>{t('scan.step2')}</strong></div>
        <div className="model-actions"><button type="button" className="model-btn primary" disabled={!scan.file || scan.busy || !geminiReady} onClick={scan.identify}>{t('scan.identify')}</button></div>
        {!geminiReady && <p className="source-note">{t('scan.needsKey')}</p>}
        {scan.busy && <p className="busy-status" aria-live="polite">{t('scan.sending')}</p>}
        {scan.roundTripMs != null && <p className="source-note">{t('scan.roundTrip', { ms: scan.roundTripMs })}</p>}
        <p className="prototype-note">{t('scan.privacy')}</p>
        {(scan.noticeKey || scan.noticeText) && <div className="notice" role="status">{scan.noticeText || t(scan.noticeKey)}</div>}
        <div className="step-two"><span className="step-number">3</span><strong>{t('scan.step3')}</strong></div>
        <div className="select-wrap"><select value={guideId} onChange={e => setGuideId(e.target.value)}>{items.map(item => { const l = localizeItem(item); return <option key={item.id} value={item.id}>{l.emoji} {l.name}</option>; })}</select></div>
      </div>
      <div className="card result-card">
        <div className="result-header"><span className="card-title">{t('scan.guideTitle')}</span><span className="fresh">{t('scan.curated')}</span></div>
        <DetectionResults detections={scan.detections} items={items} filter={scan.filter} onFilter={scan.setFilter} activeNumber={scan.active} onHover={scan.setActive}
          selectedId={guideId} onSelect={d => setGuideId(d.item_id)} onCorrect={(d, id) => { scan.correct(d, id); if (id !== scan.NOT_LISTED) setGuideId(id); }} feedbackKey={scan.feedbackKey} />
        <ItemGuide item={selected} onNearby={onNearby} />
        <div className="history">
          <div className="history-top"><strong>{t('scan.recent')}</strong><button type="button" onClick={clearHistory}>{t('scan.clear')}</button></div>
          <div className="history-list">{history.length
            ? history.slice(0, 5).map((row, i) => { const item = localizeItem(items.find(it => it.id === row.id)) || row; return <span key={`${row.id}-${i}`} className="history-chip">{item.emoji} {item.name}</span>; })
            : <span className="history-empty">{t('scan.recentEmpty')}</span>}</div>
        </div>
      </div>
    </section>
    <section className="ask-panel">
      <div className="ask-header"><span className="brand-icon">?</span><div><h2>{t('chat.title')}</h2><p>{t('chat.intro')}</p></div></div>
      <div className="chat-messages" aria-live="polite">{chat.messages.length ? chat.messages.map((row, i) => <div key={i} className={`chat-bubble ${row.role}`}>{row.text}</div>) : <div className="history-empty">{t('chat.example')}</div>}</div>
      <form className="chat-compose" onSubmit={e => { e.preventDefault(); chat.ask(); }}>
        <input value={chat.text} onChange={e => chat.setText(e.target.value)} placeholder={t('chat.placeholder')} />
        <button disabled={chat.busy || !chat.text.trim()}>{chat.busy ? '…' : t('chat.send')}</button>
      </form>
    </section>
  </>;
}
