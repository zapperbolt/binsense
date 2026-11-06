// Text-to-speech using the browser's built-in voices (no server, no cost).
// Which languages are available depends on the device: most have English
// and Chinese; Malay and Tamil voices are often missing, so callers must
// check hasVoice() and hide or disable the button.

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined);

export function findVoice(voices, speechTag) {
  const base = speechTag.split('-')[0].toLowerCase();
  const tag = speechTag.toLowerCase();
  const normal = v => v.lang.toLowerCase().replace('_', '-');
  return voices.find(v => normal(v) === tag) || voices.find(v => normal(v).split('-')[0] === base) || null;
}

// Voices load asynchronously in some browsers (Chrome); call onChange when ready.
export function watchVoices(onChange) {
  const s = synth();
  if (!s) return () => {};
  const update = () => onChange(s.getVoices());
  update();
  s.addEventListener?.('voiceschanged', update);
  return () => s.removeEventListener?.('voiceschanged', update);
}

export function speak(text, voice, { onEnd } = {}) {
  const s = synth();
  if (!s || !voice) return false;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  s.speak(utterance);
  return true;
}

export function stopSpeaking() { synth()?.cancel(); }
