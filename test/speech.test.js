import { describe, expect, it } from 'vitest';
import { findVoice } from '../src/lib/speech.js';

const voices = [{ lang: 'en-US', name: 'A' }, { lang: 'zh_CN', name: 'B' }, { lang: 'ms-MY', name: 'C' }];

describe('findVoice', () => {
  it('prefers an exact tag match', () => { expect(findVoice(voices, 'ms-MY').name).toBe('C'); });
  it('accepts the same base language (en-US for en-SG)', () => { expect(findVoice(voices, 'en-SG').name).toBe('A'); });
  it('normalises underscores (zh_CN)', () => { expect(findVoice(voices, 'zh-CN').name).toBe('B'); });
  it('returns null when no voice exists for the language', () => { expect(findVoice(voices, 'ta-IN')).toBeNull(); });
});
