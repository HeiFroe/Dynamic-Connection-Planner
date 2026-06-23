import { Asset } from '../types';
import { assetToMarkdown, markdownToAsset, extractNotesSection, assetVaultPath } from './assetMapper';

const SAMPLE: Asset = {
  id: '0ea5c870-1144-47db-bc12-13a032ff67a1',
  dbNumber: 4,
  vendor: 'Logitech',
  model: 'Rally Bar',
  partNumber: '960-001324',
  productPage: 'https://www.logitech.com/rallybar',
  category: 'collaboration-system',
  notes: 'Premium video bar for medium rooms.',
  imageAspectRatio: 4.8,
  physicalWidth: 120,
  physicalHeight: 25,
  ports: [
    {
      id: 'fc7d3bda-1900-43b1-9999-4774de007d2a',
      name: 'HDMI IN',
      layer: 'video',
      standard: 'hdmi-in',
      maleFemale: 'female',
      position: { x: 0.89, y: 0.6 },
    },
    {
      id: 'd0a5b2a9-f398-4a34-a679-52407dc8bdb0',
      name: 'Power IN',
      layer: 'power',
      standard: 'power-adapter',
      maleFemale: 'female',
      position: { x: 0.06, y: 0.6 },
      recommended: ['some-other-asset-id'],
    },
  ],
  requires: ['table-hub-power-adapter-id'],
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-20T15:30:00.000Z',
};

describe('assetMapper', () => {
  test('round-trip preserves all schema fields', () => {
    const md   = assetToMarkdown(SAMPLE, 'DCDC');
    const back = markdownToAsset(md);
    expect(back).not.toBeNull();
    if (!back) return;
    expect(back.id).toBe(SAMPLE.id);
    expect(back.dbNumber).toBe(SAMPLE.dbNumber);
    expect(back.vendor).toBe(SAMPLE.vendor);
    expect(back.model).toBe(SAMPLE.model);
    expect(back.partNumber).toBe(SAMPLE.partNumber);
    expect(back.productPage).toBe(SAMPLE.productPage);
    expect(back.category).toBe(SAMPLE.category);
    expect(back.notes).toBe(SAMPLE.notes);
    expect(back.imageAspectRatio).toBe(SAMPLE.imageAspectRatio);
    expect(back.physicalWidth).toBe(SAMPLE.physicalWidth);
    expect(back.physicalHeight).toBe(SAMPLE.physicalHeight);
    expect(back.ports.length).toBe(SAMPLE.ports.length);
    expect(back.ports[0].id).toBe(SAMPLE.ports[0].id);
    expect(back.ports[0].position).toEqual(SAMPLE.ports[0].position);
    expect(back.ports[1].recommended).toEqual(SAMPLE.ports[1].recommended);
    expect(back.requires).toEqual(SAMPLE.requires);
  });

  test('handles asset with only required fields', () => {
    const minimal: Asset = {
      id: 'min-id',
      dbNumber: 1,
      vendor: 'X',
      model: 'Y',
      category: 'cable',
      ports: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const md   = assetToMarkdown(minimal, 'DCDC');
    const back = markdownToAsset(md);
    expect(back?.partNumber).toBeUndefined();
    expect(back?.notes).toBeUndefined();
    expect(back?.ports).toEqual([]);
  });

  test('extractNotesSection finds content between ## Notes and next heading', () => {
    const body = `# Title\n\n## Notes\n\nUser wrote this.\n\n## Required Companions\n\n- foo`;
    expect(extractNotesSection(body)).toBe('User wrote this.');
  });

  test('extractNotesSection returns empty when missing', () => {
    expect(extractNotesSection('# Title\nNo notes section')).toBe('');
  });

  test('user edits to Notes section survive a round-trip', () => {
    const md       = assetToMarkdown(SAMPLE, 'DCDC');
    const edited   = md.replace(SAMPLE.notes!, 'User added their own text.');
    const back     = markdownToAsset(edited);
    expect(back?.notes).toBe('User added their own text.');
  });

  test('assetVaultPath is stable and slugifies', () => {
    const p = assetVaultPath(SAMPLE, 'DCDC');
    expect(p).toBe('DCDC/Assets/collaboration-system/logitech/rally-bar--4.md');
  });
});
