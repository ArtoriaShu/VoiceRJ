export type SubtitleCue = { startMs: number; endMs: number; text: string };

const timestamp = (value: string) => {
  const parts = value.trim().replace(',', '.').split(':').map(Number);
  if (parts.some(Number.isNaN) || parts.length < 2 || parts.length > 3) return undefined;
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
};

const clean = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '').trim();

export function parseSubtitles(raw: string, extension: string): SubtitleCue[] {
  const source = raw.replace(/^\uFEFF/, '').replace(/\r/g, '');
  if (extension === '.lrc') {
    const rows: Array<{ startMs: number; text: string }> = [];
    for (const line of source.split('\n')) {
      const text = clean(line.replace(/(?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])+/g, ''));
      for (const match of line.matchAll(/\[(\d{1,2}:\d{2}(?:[.:]\d{1,3})?)\]/g)) {
        const startMs = timestamp(match[1]);
        if (startMs !== undefined && text) rows.push({ startMs, text });
      }
    }
    return rows.sort((a, b) => a.startMs - b.startMs).map((row, index, all) => ({ ...row, endMs: all[index + 1]?.startMs ?? row.startMs + 5000 }));
  }
  const blocks = source.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex(line => line.includes('-->'));
    if (timingIndex < 0) continue;
    const [startRaw, endRaw] = lines[timingIndex].split('-->').map(part => part.trim().split(/\s+/)[0]);
    const startMs = timestamp(startRaw); const endMs = timestamp(endRaw);
    const text = clean(lines.slice(timingIndex + 1).join('\n'));
    if (startMs !== undefined && endMs !== undefined && endMs > startMs && text) cues.push({ startMs, endMs, text });
  }
  return cues;
}
