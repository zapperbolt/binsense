import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import items from './data/items.json';

const tabs = [
  ['scan', 'Scan'], ['nearby', 'Nearby bins'], ['guide', 'Quick guide'], ['community', 'Community'],
];
const estates = ['Ang Mo Kio','Bedok','Bishan','Bukit Batok','Bukit Merah','Choa Chu Kang','Clementi','Geylang','Hougang','Jurong East','Jurong West','Kallang / Whampoa','Marine Parade','Pasir Ris','Punggol','Queenstown','Sembawang','Sengkang','Serangoon','Tampines','Toa Payoh','Woodlands','Yishun'];
const locCategories = [['recycling','Blue recycling'],['ewaste','E-waste'],['textile','Clothing & reuse'],['beverage','10¢ bottle return']];
function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare that photo.')), 'image/jpeg', .82);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This photo could not be opened.')); };
    image.src = url;
  });
}
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}
function distanceKm(a, b) {
  const r = 6371, rad = v => v * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(q));
}
function MapViewport({ locations, position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], 14);
    else if (locations.length) {
      const points = locations.map(loc => [loc.lat, loc.lng]);
      map.fitBounds(points, { padding: [24,24], maxZoom: 14 });
    }
  }, [map, locations, position]);
  return null;
}
function CollectionMap({ locations, position }) {
  return <MapContainer className="app-map" center={[1.3521, 103.8198]} zoom={11} scrollWheelZoom>
    <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapViewport locations={locations} position={position} />
    {locations.slice(0,120).map(loc => <CircleMarker key={loc.id} center={[loc.lat,loc.lng]} radius={7} pathOptions={{ color:'#173b2b', fillColor:'#b9f36b', fillOpacity:.9 }}><Popup><b>{loc.name}</b><br />{loc.address}</Popup></CircleMarker>)}
    {position && <CircleMarker center={[position.lat,position.lng]} radius={8} pathOptions={{ color:'#fff', weight:3, fillColor:'#315fdb', fillOpacity:1 }}><Popup>Your approximate location</Popup></CircleMarker>}
  </MapContainer>;
}

function App() {
  const [page, setPage] = useState('scan');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [guideId, setGuideId] = useState(items[0].id);
  const [predictions, setPredictions] = useState([]);
  const [suggested, setSuggested] = useState(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(() => readLocal('binsense-history', []));
  const [locations, setLocations] = useState([]);
  const [locCategory, setLocCategory] = useState('recycling');
  const [locState, setLocState] = useState('Choose a collection type to load nearby points.');
  const [position, setPosition] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [status, setStatus] = useState('Checking AI provider…');
  const [geminiReady, setGeminiReady] = useState(false);
  const [resultMeta, setResultMeta] = useState('');
  const [communityStatus, setCommunityStatus] = useState('');
  const [scores, setScores] = useState(() => readLocal('binsense-community-scores', []));
  const modelRef = useRef(null);
  const fileInputRef = useRef(null);
  const selected = items.find(item => item.id === guideId) || items[0];

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(data => { setStatus(data.message || 'Node API ready.'); setGeminiReady(Boolean(data.ready)); })
      .catch(() => setStatus('AI provider needs the Node server; MobileNet runs locally in your browser.'));
  }, []);
  useEffect(() => { localStorage.setItem('binsense-history', JSON.stringify(history.slice(0, 20))); }, [history]);
  useEffect(() => { localStorage.setItem('binsense-community-scores', JSON.stringify(scores.slice(-100))); }, [scores]);
  const sortedLocations = useMemo(() => locations.map(loc => ({ ...loc, distance: position ? distanceKm(position, loc) : null }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)).slice(0, 120), [locations, position]);

  function selectFile(next) {
    if (!next) return;
    if (!next.type.startsWith('image/')) { setNotice('Please choose an image file.'); return; }
    setFile(next); setPreview(URL.createObjectURL(next)); setPredictions([]); setSuggested(null); setNotice(''); setResultMeta('');
  }
  function remember(item) {
    setHistory(current => [{ id: item.id, name: item.name, emoji: item.emoji, time: Date.now() }, ...current].slice(0, 20));
  }
  async function runMobileNet() {
    if (!file || busy) return;
    setBusy('Loading the browser model…'); setNotice(''); setPredictions([]); setSuggested(null);
    try {
      const blob = await resizePhoto(file);
      const imageUrl = URL.createObjectURL(blob);
      const image = new Image(); image.src = imageUrl; await image.decode();
      const mobilenet = await import('@tensorflow-models/mobilenet');
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      if (!modelRef.current) modelRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
      setBusy('Classifying on this device…');
      const startedAt = performance.now();
      const results = await modelRef.current.classify(image, 5);
      setResultMeta(`MobileNet · on device · ${Math.round(performance.now() - startedAt)} ms inference (model load excluded)`);
      URL.revokeObjectURL(imageUrl);
      setPredictions(results);
      setBusy('');
    } catch (error) { setNotice(error.message || 'The browser model could not start.'); setBusy(''); }
  }
  async function runGemini() {
    if (!file || busy) return;
    setBusy('Sending a compressed photo for AI analysis…'); setNotice(''); setPredictions([]); setSuggested(null);
    try {
      const blob = await resizePhoto(file);
      if (blob.size > 12 * 1024 * 1024) throw new Error('This photo is too large. Try cropping it.');
      const image = await blobToBase64(blob);
      const startedAt = performance.now();
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, imageType: 'image/jpeg' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Image analysis failed.');
      setResultMeta(`Gemini · hosted · ${Math.round(performance.now() - startedAt)} ms round trip`);
      const unique = [...new Set((data.items || []).map(row => row.item_id))];
      if (!unique.length) { setNotice(data.description || 'No catalog item was recognized. Try a closer photo or choose a guide item below.'); return; }
      const found = items.filter(item => unique.includes(item.id));
      found.forEach(remember); setSuggested(found[0].id); setGuideId(found[0].id);
      setPredictions(found.map(item => ({ className: item.name, probability: null, id: item.id })));
    } catch (error) { setNotice(error.message || 'Could not reach the AI service.'); }
    finally { setBusy(''); }
  }
  async function loadLocations(category = locCategory) {
    setLocCategory(category);
    if (category === 'beverage') { setLocations([]); setLocState('Live Return Right machine locations are available in the operator locator.'); return; }
    setLocState('Loading collection points…');
    try {
      const response = await fetch(`/api/locations?category=${encodeURIComponent(category)}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load collection points.');
      setLocations(data.locations || []); setLocState(`${data.source}. ${data.notice}`);
    } catch (error) { setLocations([]); setLocState(error.message || 'Could not load collection points.'); }
  }
  function locate() {
    if (!navigator.geolocation) { setLocState('Location is unavailable in this browser. Browse the results without distance sorting.'); return; }
    setLocState('Finding your location…');
    navigator.geolocation.getCurrentPosition(({ coords }) => { setPosition({ lat: coords.latitude, lng: coords.longitude }); setLocState('Location found · nearest points are shown first.'); }, error => {
      setLocState(error.code === 1 ? 'Location permission is off. Allow it in browser settings or browse without distance sorting.' : 'Could not determine location. You can still browse collection points.');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }
  async function ask() {
    const message = chatText.trim(); if (!message || chatBusy) return;
    const next = [...chat, { role: 'user', text: message }]; setChat(next); setChatText(''); setChatBusy(true);
    try {
      const response = await fetch('/api/text-analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(row => ({ role: row.role === 'assistant' ? 'model' : 'user', text: row.text })) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not answer that yet.');
      setChat([...next, { role: 'assistant', text: data.reply }].slice(-12));
    } catch (error) { setChat([...next, { role: 'assistant', text: error.message || 'Could not reach BinSense right now.' }].slice(-12)); }
    finally { setChatBusy(false); }
  }
  function submitCommunity(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (!form.get('name') || !form.get('estate') || !form.get('proof')?.size) { setCommunityStatus('Add a display name, choose an estate, and attach a photo.'); return; }
    const row = { name: String(form.get('name')).trim(), estate: String(form.get('estate')), points: 5, status: 'pending', createdAt: Date.now() };
    setScores(current => [row, ...current].slice(0, 100)); setCommunityStatus('Action submitted · 5 points pending review. This local demo does not upload your photo.'); event.currentTarget.reset();
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-icon">↗</span>BinSense<em>/ sort it right</em></div>
      <nav className="nav" aria-label="Main navigation">{tabs.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{label}</button>)}</nav>
      <div className="location"><b>Singapore</b><br />AI-assisted · check uncertain items</div></header>
    {page === 'scan' && <>
      <section className="hero"><div><div className="eyebrow"><span className="pulse" /> WASTE SORTING · SINGAPORE</div><h1>Know where it<br /><span>goes next.</span></h1><p>Take a photo, check the suggestion, then follow the local guide.</p></div><div className="hero-stat"><span className="stat-icon">♻</span><div><strong>Sort with context</strong><small>Material + condition matter</small></div></div></section>
      <section className="grid">
        <div className="card scan-card"><div className="card-top"><span className="card-title">Add a photo</span><span className="step">STEP 01</span></div>
          <div className={`dropzone ${preview ? 'has-photo' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}>
            {preview ? <><img src={preview} alt="Selected waste item" /><div className="photo-actions"><button className="tiny-btn" onClick={() => fileInputRef.current?.click()}>Change photo</button><button className="tiny-btn" onClick={() => { setFile(null); setPreview(''); setPredictions([]); setSuggested(null); }}>Remove</button></div></> : <div className="upload-content"><div className="upload-icon">＋</div><strong>Drop a photo here</strong><p>or use the camera on your phone</p><button className="choose-btn" onClick={() => fileInputRef.current?.click()}>Choose photo</button></div>}
            <input ref={fileInputRef} id="fileInput" type="file" accept="image/*" capture="environment" onChange={e => selectFile(e.target.files[0])} />
          </div>
          <div className="step-two"><span className="step-number">2</span><strong>Gemini worked better in your trial; use it for disposal suggestions</strong></div>
          <div className="model-actions"><button className="model-btn primary" disabled={!file || !!busy || !geminiReady} onClick={runGemini}>Identify with Gemini</button><button className="model-btn local" disabled={!file || !!busy} onClick={runMobileNet}>Fast experimental labels · MobileNet</button></div>
          {busy && <p className="busy-status" aria-live="polite">{busy}</p>}
          {resultMeta && <p className="source-note">{resultMeta}</p>}
          <p className="prototype-note">MobileNet runs in your browser after its model downloads. Its ImageNet score is not a verified waste-classification probability. Gemini receives the compressed photo for analysis.</p>
          {notice && <div className="notice" role="status">{notice}</div>}
          <div className="step-two"><span className="step-number">3</span><strong>Choose an item to see its guide</strong></div>
          <div className="select-wrap"><select value={guideId} onChange={e => setGuideId(e.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></div>
        </div>
        <div className="card result-card"><div className="result-header"><span className="card-title">Disposal guide</span><span className="fresh">CURATED · SG</span></div>
          {predictions.length > 0 && <div className="predictions"><p className="detected-count">{predictions.some(row => row.id) ? 'AI suggestion · confirm the item and condition' : 'MobileNet ImageNet labels · not waste classifications'}</p>{predictions.map((row, index) => <div className="prediction" key={`${row.className}-${index}`}><span>{row.className}</span><b>{row.probability == null ? 'matched' : `${Math.round(row.probability * 100)}% score`}</b>{row.id && <button onClick={() => { setGuideId(row.id); remember(items.find(item => item.id === row.id)); }}>Use this guide</button>}</div>)}</div>}
          <ItemGuide item={selected} onNearby={category => { setPage('nearby'); loadLocations(category); }} />
          <div className="history"><div className="history-top"><strong>Recent checks</strong><button onClick={() => setHistory([])}>Clear</button></div><div className="history-list">{history.length ? history.slice(0, 5).map((row, i) => <span key={`${row.id}-${i}`} className="history-chip">{row.emoji} {row.name}</span>) : <span className="history-empty">Your checked items will show up here.</span>}</div></div>
        </div>
      </section>
      <section className="ask-panel"><div className="ask-header"><span className="brand-icon">?</span><div><h2>Ask BinSense</h2><p>Follow up about an item or a sorting rule. Hosted AI is used for replies.</p></div></div><div className="chat-messages" aria-live="polite">{chat.length ? chat.map((row, i) => <div key={i} className={`chat-bubble ${row.role}`}>{row.text}</div>) : <div className="history-empty">Try: “What if the cardboard is greasy?”</div>}</div><form className="chat-compose" onSubmit={e => { e.preventDefault(); ask(); }}><input value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Ask about an item…" /><button disabled={chatBusy || !chatText.trim()}>{chatBusy ? '…' : 'Send'}</button></form></section>
    </>}
    {page === 'guide' && <><PageHero eyebrow="QUICK GUIDE · SINGAPORE" title={<>Five routes.<br /><span>Less guesswork.</span></>} text="Use the item's material and condition—not just its recycling symbol." /><div className="guide-grid">{[['♻️','Blue recycling','Keep accepted paper, plastic, metal and glass clean and dry.'],['🌱','Food scraps','Use a suitable home compost setup; otherwise use general waste.'],['🗑️','General waste','Food-stained paper, tissue and foam do not go in the blue bin.'],['🔋','E-waste','Use a dedicated collection point for batteries and electronics.'],['🧺','Textile reuse','Keep accepted clothing clean and dry; check the operator’s accepted-items list.'],['💰','Return Right · 10¢','Only eligible marked drink containers qualify. Keep them empty and uncrushed.']].map(([icon,title,text]) => <article className="guide-tile" key={title}><span className="gicon">{icon}</span><h3>{title}</h3><p>{text}</p></article>)}</div><div className="guide-list"><h2>Item-by-item guidance</h2>{items.map(item => <details key={item.id}><summary>{item.emoji} {item.name}</summary><p>{item.answer}: {item.instruction}</p><small>{item.source}</small></details>)}</div></>}
    {page === 'nearby' && <><PageHero eyebrow="FIND A DROP-OFF POINT" title={<>Right item.<br /><span>Right place.</span></>} text="Browse Singapore collection points. Listings may be outdated; confirm acceptance before travelling." />
      <section className="guide-panel"><div className="locator-controls">{locCategories.map(([id,label]) => <button key={id} className={locCategory===id?'active':''} onClick={() => loadLocations(id)}>{label}</button>)}</div><div className="location-head"><p className="location-state">{locState}</p><div className="locator-actions"><button className="location-button" onClick={locate}>Use my location</button>{locCategory==='beverage' && <a className="locator-link" href="https://returnright.sg/p/find-my-nearest-rvm" target="_blank" rel="noreferrer">Open Return Right locator ↗</a>}</div></div>
      <div className="locator-layout"><CollectionMap locations={sortedLocations} position={position} /><div className="location-results">{sortedLocations.length ? sortedLocations.map(loc => <article className="location-result" key={loc.id}><h3>{loc.name}</h3><p>{loc.address}</p><p>{loc.accepted}</p><span className="location-distance">{loc.distance == null ? 'Singapore collection point' : `${loc.distance.toFixed(1)} km away`}</span><br /><a className="locator-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer">Directions ↗</a></article>) : <div className="empty-locations">Collection points appear here after loading a category. Map tiles need an internet connection.</div>}</div></div>
      </section></>}
    {page === 'community' && <><PageHero eyebrow="BIN SENSE COMMUNITY" title={<>Small actions.<br /><span>Neighbourhood impact.</span></>} text="Log a recycling action. This local prototype keeps entries on this device only." /><section className="guide-panel"><form className="community-form" onSubmit={submitCommunity}><label>Display name<input name="name" maxLength="24" placeholder="e.g. Green Neighbour" required /></label><label>Estate<select name="estate" required defaultValue=""><option value="" disabled>Choose your estate</option>{estates.map(estate => <option key={estate}>{estate}</option>)}</select></label><label>Photo evidence<input name="proof" type="file" accept="image/*" capture="environment" required /></label><button className="confirm">Submit action for review</button></form><p className="community-status">{communityStatus}</p><div className="leaderboard"><h3>Estate leaderboard <span className="pilot-label">LOCAL PILOT</span></h3><p className="source-note">Self-reported, pending points on this device. No shared accounts or real prizes.</p>{scores.length ? [...scores].sort((a,b)=>b.points-a.points).slice(0,10).map((row,i)=><div className="leaderboard-row" key={`${row.createdAt}-${i}`}><b>{i+1}</b><span>{row.name}<small>{row.estate} · pending</small></span><span className="leaderboard-points">{row.points} pts</span></div>) : <p className="source-note">No local actions recorded yet.</p>}</div></section></>}
    <footer className="foot"><span>{status}</span><span>Photos stay in the browser when using MobileNet. Hosted analysis sends them to the configured AI provider.</span></footer>
  </main>;
}

function ItemGuide({ item, onNearby }) {
  const symbols = { recycle:'♻️', compost:'🌱', general:'🗑️', special:'🔋', textile:'🧺' };
  const labels = { recycle:'RECYCLE', compost:'COMPOST IF YOU HAVE A SETUP', general:'NOT FOR THE BLUE BIN', special:'SPECIAL COLLECTION', textile:'TEXTILE DROP-OFF' };
  const category = item.id === 'battery' || item.id === 'phone' ? 'ewaste' : item.id === 'clothing' ? 'textile' : 'recycling';
  const isDrinkContainer = item.id === 'plastic-bottle' || item.id === 'aluminium-can';
  return <section className="detected-item"><div className="item-heading"><div className="item-emoji">{item.emoji}</div><div><h2>{item.name}</h2><p>{item.material}</p></div></div><p className="prototype-note">AI suggestion · confirm the material and condition; a photo may not show residue or hidden material.</p><div className={`bin-answer ${item.category}`}><div className="bin-symbol">{symbols[item.category]}</div><div><div className="answer-label">{labels[item.category]}</div><h3 className="answer-title">{item.answer}</h3><p className="answer-description">{item.instruction}</p></div></div><div className="answer-actions"><button onClick={() => onNearby(category)}>Find a nearby collection point</button>{isDrinkContainer && <button onClick={() => onNearby('beverage')}>Check 10¢ return points</button>}</div>{isDrinkContainer && <p className="source">10¢ applies only to eligible 150 ml–3 L plastic or metal drink containers with the BCRS Deposit Mark. Keep them empty, uncrushed, with barcode visible.</p>}<div className="tip"><span className="tip-icon">💡</span><p><b>One thing to know</b><br />{item.tip}</p></div><p className="source">Guidance: {item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.source}</a> : item.source}</p></section>;
}
function PageHero({ eyebrow, title, text }) { return <section className="hero"><div><div className="eyebrow"><span className="pulse" /> {eyebrow}</div><h1>{title}</h1><p>{text}</p></div></section>; }

export default App;
