import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import { expect, test } from 'vitest';
import { parseOsu } from '../../src/editor/osu/parseOsu';
import { openOsuArchive } from '../../src/editor/osu/osuArchive';
import { applyOsuBeatmap } from '../../src/editor/osu/osuMarkers';
import { DEFAULT_OSU_IMPORT_OPTIONS } from '../../src/editor/osu/osuTypes';
import { createInitialEditorProject } from '../../src/editor/projectCodec';

const root = process.env.OSU_REFERENCE_ROOT;
test.skipIf(!root)(
    'converts all 18 local reference difficulties and validates their original archive audio',
    async () => {
        let mapCount = 0,
            objectCount = 0,
            archiveCount = 0;
        for (const set of await readdir(root!, { withFileTypes: true })) {
            if (!set.isDirectory()) continue;
            const folder = path.join(root!, set.name),
                files = await readdir(folder);
            for (const name of files.filter(f => f.endsWith('.osu'))) {
                const beatmap = parseOsu(await readFile(path.join(folder, name), 'utf8'));
                const audioPath = path.join(folder, beatmap.audioFilename),
                    metadata = await parseFile(audioPath),
                    audio = await readFile(audioPath);
                const initial = createInitialEditorProject({
                    track: {
                        contentHash: createHash('sha256').update(audio).digest('hex'),
                        fileName: beatmap.audioFilename,
                        durationSeconds: metadata.format.duration!,
                        sampleRate: metadata.format.sampleRate,
                    },
                });
                const candidate = applyOsuBeatmap(initial, beatmap, {
                    ...DEFAULT_OSU_IMPORT_OPTIONS,
                    replaceTempo: true,
                    bookmarks: true,
                    breaks: true,
                    kiai: true,
                });
                const noteLanes = candidate.lanes.filter(l => !/ · (书签|休息|Kiai)$/.test(l.name));
                expect(
                    noteLanes.reduce((count, lane) => count + lane.events.length, 0),
                    name,
                ).toBe(beatmap.objects.length);
                const red = beatmap.timingPoints.filter(p => p.uninherited);
                if (name.includes('Rush E')) {
                    expect(red).toHaveLength(165);
                    const bpms = candidate.tempoMap.flatMap(s => (s.mode === 'metered' && s.bpm ? [s.bpm] : []));
                    expect(Math.min(...bpms)).toBeCloseTo(15, 8);
                    expect(Math.max(...bpms)).toBeCloseTo(1020, 8);
                    expect(candidate.tempoMap).toHaveLength(166);
                }
                if (name.includes('STYX HELIX') || name.includes('OUR SHIP')) {
                    const segment = candidate.tempoMap[0]!;
                    expect(segment).toMatchObject({
                        beatOriginSeconds: name.includes('STYX HELIX') ? -1.866 : 0.927231,
                    });
                    if (segment.mode !== 'metered') throw Error('fixture');
                    expect(segment.bpm).toBeCloseTo(name.includes('STYX HELIX') ? 123 : 144, 8);
                }
                mapCount++;
                objectCount += beatmap.objects.length;
            }
            for (const name of files.filter(f => f.endsWith('.osz'))) {
                const archive = await openOsuArchive(await readFile(path.join(folder, name)));
                expect(
                    archive.beatmaps.every(e => !!e.beatmap),
                    name,
                ).toBe(true);
                for (const entry of archive.beatmaps) {
                    const audio = await archive.readAudio(entry.path, entry.beatmap!.audioFilename);
                    expect(
                        Buffer.from(audio.bytes).equals(
                            await readFile(path.join(folder, entry.beatmap!.audioFilename)),
                        ),
                    ).toBe(true);
                }
                archive.release();
                archiveCount++;
            }
        }
        expect({ mapCount, objectCount, archiveCount }).toEqual({ mapCount: 18, objectCount: 9392, archiveCount: 3 });
    },
    60000,
);
