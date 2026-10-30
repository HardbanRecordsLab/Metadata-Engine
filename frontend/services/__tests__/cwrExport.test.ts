import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveCwr, cwrNotice } from '../distributionService';

const resp = (body: BodyInit, init: ResponseInit & { headers?: Record<string, string> }) => new Response(body, init);

beforeEach(() => {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
});

describe('saveCwr', () => {
  it('saves the file under the server name and reports a draft with what is missing', async () => {
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download); });
    const r = await saveCwr(resp('HDR...', { status: 200, headers: { 'content-disposition': 'attachment; filename="DRAFT_CW260001000_000.V21"', 'x-cwr-submittable': 'false', 'x-cwr-missing': 'the sender ID; IPI number of writer DOE' } }), 'fallback.cwr');
    expect(r).toEqual({ filename: 'DRAFT_CW260001000_000.V21', submittable: false, missing: 'the sender ID; IPI number of writer DOE' });
    expect(clicked).toEqual(['DRAFT_CW260001000_000.V21']);
    expect(cwrNotice(r)).toEqual({ type: 'info', text: expect.stringContaining('Not ready to send') });
    expect(cwrNotice(r).text).toContain('the sender ID');
  });

  it('a complete file is reported as ready', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const r = await saveCwr(resp('x', { status: 200, headers: { 'content-disposition': 'attachment; filename="CW260001HRL_ZAI.V21"', 'x-cwr-submittable': 'true', 'x-cwr-missing': '-' } }), 'f.cwr');
    expect(r.submittable).toBe(true);
    expect(cwrNotice(r)).toEqual({ type: 'success', text: 'CWR file ready: CW260001HRL_ZAI.V21' });
  });

  it('falls back to a file name when the server sends none', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect((await saveCwr(resp('x', { status: 200 }), 'fallback.cwr')).filename).toBe('fallback.cwr');
  });

  it('throws the server explanation when the registration cannot be built', async () => {
    const err = resp(JSON.stringify({ detail: ['The performing (PR) shares add up to 90, not 100.', 'Several writers are named, but their shares are not: add them.'] }), { status: 422 });
    await expect(saveCwr(err, 'f.cwr')).rejects.toThrow('add up to 90, not 100. Several writers');
    await expect(saveCwr(resp('<html>', { status: 500 }), 'f.cwr')).rejects.toThrow('Failed to generate CWR record');
    await expect(saveCwr(resp(JSON.stringify({ detail: 'Job not found' }), { status: 404 }), 'f.cwr')).rejects.toThrow('Job not found');
  });
});
