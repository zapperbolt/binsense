import { useEffect, useRef, useState } from 'react';
import { api, errorKeyFor } from '../lib/api.js';
import { blobToBase64, resizePhoto } from '../lib/photo.js';
import { NOT_LISTED, applyCorrection, enrichDetections } from '../lib/sorting.js';

// All state for the Scan page lives here (not in the page component) so it
// survives switching tabs. App owns this hook and passes it down.
export function useScan({ itemsById, lang, onItemsFound }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [imageSize, setImageSize] = useState(null);
  const [detections, setDetections] = useState([]);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [noticeKey, setNoticeKey] = useState('');
  const [noticeText, setNoticeText] = useState('');
  const [roundTripMs, setRoundTripMs] = useState(null);
  const [feedbackKey, setFeedbackKey] = useState('');
  // Bumped whenever the photo changes, so a slow Gemini reply for an old
  // photo is ignored instead of drawing boxes on the new one.
  const photoVersion = useRef(0);

  // Each preview is an object URL holding the image in memory until revoked.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetResults() {
    setDetections([]); setFilter('all'); setActive(null); setNoticeKey(''); setNoticeText(''); setRoundTripMs(null); setFeedbackKey('');
  }
  function selectFile(next) {
    if (!next) return;
    if (!next.type.startsWith('image/')) { setNoticeKey('scan.notImage'); return; }
    photoVersion.current += 1;
    setFile(next); setPreview(URL.createObjectURL(next)); setImageSize(null); resetResults();
  }
  function clearPhoto() {
    photoVersion.current += 1;
    setFile(null); setPreview(''); setImageSize(null); resetResults();
  }

  async function identify() {
    if (!file || busy) return;
    const version = photoVersion.current;
    setBusy(true); resetResults();
    let image;
    try {
      image = await blobToBase64(await resizePhoto(file));
    } catch {
      setBusy(false);
      if (version === photoVersion.current) setNoticeKey('err.photoRead');
      return;
    }
    try {
      const startedAt = performance.now();
      const res = await api('/api/analyze', { method: 'POST', body: { image, imageType: 'image/jpeg', language: lang } });
      if (version !== photoVersion.current) return;
      if (!res.ok) { setNoticeKey(errorKeyFor(res.status)); return; }
      setRoundTripMs(Math.round(performance.now() - startedAt));
      const found = enrichDetections(res.data?.items, itemsById);
      if (!found.length) {
        // Gemini's description is free text in the chosen language; fall
        // back to our own message if it didn't send one.
        if (res.data?.description) setNoticeText(res.data.description); else setNoticeKey('scan.nothingFound');
        return;
      }
      setDetections(found);
      onItemsFound(found);
    } catch {
      if (version === photoVersion.current) setNoticeKey('err.network');
    } finally {
      setBusy(false);
    }
  }

  // Updates the result immediately (optimistic UI), then reports the
  // correction to the server. A failed send doesn't undo the local fix.
  async function correct(detection, correctedId) {
    const originalId = detection.originalId ?? detection.item_id;
    setDetections(current => applyCorrection(current, detection.number, correctedId, itemsById));
    if (correctedId === originalId) return;
    try {
      const res = await api('/api/corrections', { method: 'POST', body: { predicted: originalId, corrected: correctedId, label: detection.label, confidence: detection.confidence } });
      setFeedbackKey(res.ok ? 'det.thanks' : 'det.correctionFailed');
    } catch {
      setFeedbackKey('det.correctionFailed');
    }
  }

  return {
    file, preview, imageSize, setImageSize, detections, filter, setFilter, active, setActive,
    busy, noticeKey, noticeText, roundTripMs, feedbackKey, selectFile, clearPhoto, identify, correct, NOT_LISTED,
  };
}
