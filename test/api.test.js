import { afterEach, describe, expect, it } from 'vitest';
import { RELAXED_LIMITS, fakeGemini, postJson, startServer } from './helpers.js';

let server;
afterEach(async () => { await server?.close(); server = undefined; });

describe('GET /api/locations', () => {
  it('rejects unknown categories with 400', async () => {
    server = await startServer({ fetchImpl: async () => { throw new Error('should not fetch'); } });
    const res = await fetch(`${server.url}/api/locations?category=plastic`);
    expect(res.status).toBe(400);
  });
  it.each(['toString', '__proto__', 'constructor', 'hasOwnProperty'])('rejects inherited object key %s with 400', async key => {
    server = await startServer({ fetchImpl: async () => { throw new Error('should not fetch'); } });
    const res = await fetch(`${server.url}/api/locations?category=${key}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/analyze', () => {
  const body = JSON.stringify({ image: 'aGVsbG8=', imageType: 'image/jpeg' });
  const post = (url, b = body) => fetch(`${url}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b });

  it('returns 503 when no API key is configured', async () => {
    server = await startServer({ apiKey: '' });
    expect((await post(server.url)).status).toBe(503);
  });
  it('rejects unsupported image types', async () => {
    server = await startServer({ apiKey: 'test' });
    expect((await post(server.url, JSON.stringify({ image: 'aGVsbG8=', imageType: 'image/gif' }))).status).toBe(415);
  });
  it('filters out IDs that are not in the catalog', async () => {
    const gemini = fakeGemini(JSON.stringify({ items: [{ item_id: 'plastic-bottle', confidence: 'high' }, { item_id: 'rocket', confidence: 'high' }], description: 'desk' }));
    server = await startServer({ apiKey: 'test', fetchImpl: gemini.fetchImpl });
    const data = await (await post(server.url)).json();
    expect(data.items.map(i => i.item_id)).toEqual(['plastic-bottle']);
  });
  it('returns labelled detections with boxes and sends the image to Gemini', async () => {
    const gemini = fakeGemini(JSON.stringify({ items: [{ item_id: 'tissue', label: 'used tissue', confidence: 'high', box_2d: [0, 0, 500, 500] }], description: 'desk' }));
    server = await startServer({ apiKey: 'test', fetchImpl: gemini.fetchImpl });
    const data = await (await post(server.url)).json();
    expect(data.items).toEqual([{ item_id: 'tissue', label: 'used tissue', confidence: 'high', box: { top: 0, left: 0, bottom: 0.5, right: 0.5 }, condition: 'cannot_tell' }]);
    expect(gemini.calls[0].body.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'aGVsbG8=' });
  });
  it('returns 400 when no image is sent', async () => {
    server = await startServer({ apiKey: 'test' });
    expect((await post(server.url, JSON.stringify({ imageType: 'image/jpeg' }))).status).toBe(400);
  });
  it('returns 502 when Gemini sends unreadable JSON', async () => {
    server = await startServer({ apiKey: 'test', fetchImpl: fakeGemini('not json').fetchImpl });
    expect((await post(server.url)).status).toBe(502);
  });
  it('maps Gemini 429 to 429', async () => {
    server = await startServer({ apiKey: 'test', fetchImpl: fakeGemini('{}', { status: 429 }).fetchImpl });
    expect((await post(server.url)).status).toBe(429);
  });
});

describe('POST /api/analyze language', () => {
  it('asks Gemini for labels in the requested language', async () => {
    const gemini = fakeGemini('{"items":[],"description":""}');
    server = await startServer({ apiKey: 'test', fetchImpl: gemini.fetchImpl });
    await postJson(`${server.url}/api/analyze`, { image: 'aGVsbG8=', imageType: 'image/jpeg', language: 'zh' });
    expect(gemini.calls[0].body.contents[0].parts[0].text).toContain('Simplified Chinese');
  });
});

describe('POST /api/text-analyze', () => {
  it('tells Gemini which language to reply in', async () => {
    const gemini = fakeGemini('{"reply":"ok","item_ids":[]}');
    server = await startServer({ apiKey: 'test', fetchImpl: gemini.fetchImpl });
    const res = await postJson(`${server.url}/api/text-analyze`, { messages: [{ role: 'user', text: 'hi' }], language: 'ms' });
    expect(res.status).toBe(200);
    expect(gemini.calls[0].body.systemInstruction.parts[0].text).toContain('Reply in Malay.');
  });
  it('rejects oversized chat bodies with 413 JSON', async () => {
    server = await startServer({ apiKey: 'test' });
    const res = await postJson(`${server.url}/api/text-analyze`, { messages: [{ role: 'user', text: 'x'.repeat(30_000) }] });
    expect(res.status).toBe(413);
    expect(await res.json()).toHaveProperty('error');
  });
  it('rejects malformed JSON with 400 JSON', async () => {
    server = await startServer({ apiKey: 'test' });
    const res = await postJson(`${server.url}/api/text-analyze`, '{oops');
    expect(res.status).toBe(400);
  });
});

describe('corrections API', () => {
  it('stores a valid correction with the model name', async () => {
    server = await startServer({ model: 'test-model' });
    const res = await postJson(`${server.url}/api/corrections`, { predicted: 'plastic-bottle', corrected: 'shampoo-bottle', label: 'blue bottle' });
    expect(res.status).toBe(201);
    expect(server.correctionStore.list()[0]).toMatchObject({ predicted: 'plastic-bottle', corrected: 'shampoo-bottle', model: 'test-model' });
  });
  it('rejects an invalid correction', async () => {
    server = await startServer();
    expect((await postJson(`${server.url}/api/corrections`, { predicted: 'x', corrected: 'y' })).status).toBe(400);
  });
});

describe('reports API', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9]).toString('base64');
  const report = { issue: 'overflowing', binType: 'recycling', lat: 1.3, lng: 103.8, note: 'full' };

  it('creates a report and lists it', async () => {
    server = await startServer();
    const res = await postJson(`${server.url}/api/reports`, report);
    expect(res.status).toBe(201);
    const { reports } = await (await fetch(`${server.url}/api/reports`)).json();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ issue: 'overflowing', note: 'full', photoUrl: null });
  });
  it('stores and serves a photo as image/jpeg', async () => {
    server = await startServer();
    const { report: created } = await (await postJson(`${server.url}/api/reports`, { ...report, photo: jpeg })).json();
    const photo = await fetch(`${server.url}${created.photoUrl}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await photo.arrayBuffer()).toString('base64')).toBe(jpeg);
  });
  it.each(['..%2F..%2Fpackage.json', 'not-a-uuid', '0b6c2f1e-3d4a-4b5c-8d9e-0f1a2b3c4d5e'])('returns 404 for photo id %s', async id => {
    server = await startServer();
    expect((await fetch(`${server.url}/api/reports/${id}/photo`)).status).toBe(404);
  });
  it('rejects invalid reports', async () => {
    server = await startServer();
    expect((await postJson(`${server.url}/api/reports`, { ...report, lat: 0 })).status).toBe(400);
  });
});

describe('rate limiting', () => {
  it('returns 429 after the limit and does not call Gemini again', async () => {
    const gemini = fakeGemini('{"items":[],"description":""}');
    const tight = { windowMs: 60_000, limit: 2 };
    server = await startServer({ apiKey: 'test', fetchImpl: gemini.fetchImpl, limits: { ...RELAXED_LIMITS, analyze: tight } });
    const body = { image: 'aGVsbG8=', imageType: 'image/jpeg' };
    const statuses = [];
    for (let i = 0; i < 3; i += 1) statuses.push((await postJson(`${server.url}/api/analyze`, body)).status);
    expect(statuses).toEqual([200, 200, 429]);
    expect(gemini.calls).toHaveLength(2);
  });
});

describe('security headers and unknown routes', () => {
  it('sends a Content-Security-Policy and nosniff', async () => {
    server = await startServer();
    const res = await fetch(`${server.url}/api/status`);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-powered-by')).toBeNull();
  });
  it('returns JSON 404 for unknown API paths', async () => {
    server = await startServer();
    const res = await fetch(`${server.url}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found.' });
  });
});

describe('server resilience', () => {
  const brokenStore = { list: () => [], add: async () => { throw new Error('disk full'); } };
  it('answers 500 (and keeps running) when saving a correction fails', async () => {
    server = await startServer({ correctionStore: brokenStore });
    const res = await postJson(`${server.url}/api/corrections`, { predicted: 'tissue', corrected: 'not-listed' });
    expect(res.status).toBe(500);
    expect((await fetch(`${server.url}/api/status`)).status).toBe(200);
  });
  it('answers 500 and removes the photo when saving a report fails', async () => {
    const { readdir } = await import('node:fs/promises');
    server = await startServer({ reportStore: brokenStore });
    const photo = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]).toString('base64');
    const res = await postJson(`${server.url}/api/reports`, { issue: 'damaged', lat: 1.3, lng: 103.8, photo });
    expect(res.status).toBe(500);
    expect(await readdir(`${server.dataDir}/photos`)).toEqual([]);
  });
  it('only adds upgrade-insecure-requests when behind an HTTPS proxy', async () => {
    server = await startServer();
    expect((await fetch(`${server.url}/api/status`)).headers.get('content-security-policy')).not.toContain('upgrade-insecure-requests');
    await server.close();
    server = await startServer({ trustProxy: 1 });
    expect((await fetch(`${server.url}/api/status`)).headers.get('content-security-policy')).toContain('upgrade-insecure-requests');
  });
});
