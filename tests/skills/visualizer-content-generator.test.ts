import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { validateContentBrief } from '../../skills/visualizer-content-generator/scripts/validate-content-brief.mjs';

const validatorUrl = new URL('../../skills/visualizer-content-generator/scripts/validate-content-brief.mjs', import.meta.url);
const validatorPath = fileURLToPath(validatorUrl);
const temporaryDirectories: string[] = [];
// Intake JSON intentionally varies across tests, independent of runtime Project V3 types.
type Intake = Record<string, any>;
function newElement(): Intake {
  return { key: 'gradient', origin: 'new', type: 'gradient-background', kind: 'visual',
    appearance: 'Two colors form a gradient', spatialStructure: 'Fills the composition', motion: 'Static' };
}
function brief(elements = [newElement()], kind = 'element'): Intake {
  return { schemaVersion: 1, kind, intent: 'Add editable visual content', elements };
}
function dynamic(source: Intake = { kind: 'analysis', shape: 'vector' }): Intake {
  return { parameter: 'spectrum', drivenProperty: 'height of each column', source,
    response: { lowOrInactive: 'short dim columns', highOrActive: 'tall bright columns', vectorMapping: 'one band per column' },
    time: { mode: 'attack-release', attackSeconds: .04, releaseSeconds: .2 } };
}
function preset(): Intake {
  return brief([
    { key: 'background', origin: 'existing', type: 'solid', kind: 'visual',
      bindings: [{ parameter: 'color', drivenProperty: 'background color', source: { kind: 'constant', value: '#000000' } }] },
    { key: 'rings', origin: 'existing', type: 'reactive-rings', kind: 'visual' },
    { key: 'scale', origin: 'existing', type: 'scale', kind: 'modifier', targets: { kind: 'elements', keys: ['rings'] } },
    { key: 'fade', origin: 'existing', type: 'fade', kind: 'transition', timing: { kind: 'unbound' }, targets: { kind: 'composition' } },
  ], 'preset');
}
function paths(value: unknown) {
  const result = validateContentBrief(value);
  expect(result.status).toBe('INPUT_INCOMPLETE');
  return result.errors.map((error: { path: string }) => error.path);
}
function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'visualizer-content-brief-'));
  temporaryDirectories.push(directory);
  return directory;
}
function runCli(args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [validatorPath, ...args], { cwd, encoding: 'utf8', windowsHide: true });
  expect(result.error).toBeUndefined();
  expect(result.stderr).toBe('');
  return { exitCode: result.status, output: JSON.parse(result.stdout) };
}
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('VisualizerContentBriefV1', () => {
  it('accepts a static new element without inventing audio bindings and leaves input unchanged', () => {
    const value = brief(), before = structuredClone(value);
    expect(validateContentBrief(value)).toEqual({ status: 'READY_FOR_CONTRACT', errors: [],
      summary: { kind: 'element', elementCount: 1, newElementCount: 1, bindingCount: 0, referenceImageCount: 0 } });
    expect(value).toEqual(before);
  });
  it('accepts a reuse-only preset and a preset containing a new element', () => {
    const value = preset();
    expect(validateContentBrief(value)).toMatchObject({ status: 'READY_FOR_CONTRACT', summary: { elementCount: 4, newElementCount: 0 } });
    value.elements.push(newElement());
    expect(validateContentBrief(value)).toMatchObject({ status: 'READY_FOR_CONTRACT', summary: { elementCount: 5, newElementCount: 1 } });
  });
  it.each([
    { kind: 'analysis', shape: 'scalar' }, { kind: 'analysis', shape: 'vector' },
    { kind: 'native', featureId: 'frequency' }, { kind: 'native', featureId: 'waveform' },
  ])('accepts complete dynamic intent for $kind $shape $featureId', source => {
    const e = newElement(); e.bindings = [dynamic(source)];
    if (source.kind === 'analysis' && source.shape === 'scalar') delete e.bindings[0].response.vectorMapping;
    expect(validateContentBrief(brief([e]))).toMatchObject({ status: 'READY_FOR_CONTRACT', summary: { bindingCount: 1 } });
  });
  it('accepts new modifier/transition intents with valid timing and explicit unbound targets', () => {
    const e = { ...newElement(), kind: 'modifier', targets: { kind: 'elements', keys: [] }, timing: { kind: 'manual', description: 'Whole song' } };
    expect(validateContentBrief(brief([e])).status).toBe('READY_FOR_CONTRACT');
    e.kind = 'transition'; e.timing = { kind: 'editor-range', description: 'Explicitly selected same-song range' };
    expect(validateContentBrief(brief([e])).status).toBe('READY_FOR_CONTRACT');
  });
  it.each([0, true, '#ffeeaa', [], [-1, 0, .5]].map(value => ({ value })))('accepts constant value $value', ({ value }) => {
    const e = newElement(); e.bindings = [{ parameter: 'value', drivenProperty: 'visual value', source: { kind: 'constant', value } }];
    expect(validateContentBrief(brief([e])).status).toBe('READY_FOR_CONTRACT');
  });
  it.each([null, Infinity, [NaN], ['1'], {}].map(value => ({ value })))('rejects invalid constant $value', ({ value }) => {
    const e = newElement(); e.bindings = [{ parameter: 'value', drivenProperty: 'visual value', source: { kind: 'constant', value } }];
    expect(paths(brief([e]))).toContain('$.elements[0].bindings[0].source.value');
  });
  it('rejects missing intent, new element appearance/structure/motion, empty elements and wrong single-element mode', () => {
    expect(paths({ schemaVersion: 1, kind: 'element', elements: [{ key: 'new', type: 'new', origin: 'new', kind: 'visual' }] }))
      .toEqual(expect.arrayContaining(['$.intent', '$.elements[0].appearance', '$.elements[0].spatialStructure', '$.elements[0].motion']));
    expect(paths(brief([]))).toContain('$.elements');
    expect(paths(brief(preset().elements))).toContain('$.elements');
    expect(paths(brief([preset().elements[0]]))).toContain('$.elements');
  });
  it('accepts explicit unbound input without pretending incomplete dynamic semantics are configured', () => {
    const e = newElement(); e.bindings = [{ parameter: 'spectrum', drivenProperty: 'column height', source: { kind: 'unbound' } }];
    expect(validateContentBrief(brief([e])).status).toBe('READY_FOR_CONTRACT');
    e.bindings[0].response = { lowOrInactive: 'zero', highOrActive: 'high' };
    expect(paths(brief([e]))).toContain('$.elements[0].bindings[0].response');
  });
  it('rejects old briefs and unknown fields at nested boundaries', () => {
    expect(paths({ schemaVersion: 1, primaryEffect: {} })).toContain('$.primaryEffect');
    const value = preset(); value.extra = true; value.elements[0].unexpected = true;
    value.elements[0].bindings[0].source.script = 'run()';
    value.elements[3].timing.eventId = 'guessed';
    value.elements[2].targets.ids = ['uuid'];
    expect(paths(value)).toEqual(expect.arrayContaining(['$.extra', '$.elements[0].unexpected',
      '$.elements[0].bindings[0].source.script', '$.elements[3].timing.eventId', '$.elements[2].targets.ids']));
  });
  it('requires complete responses, vector mapping and integrated movement units/boundaries', () => {
    const e = newElement(), b = dynamic(); e.bindings = [b];
    delete b.response.vectorMapping; delete b.response.highOrActive; b.time = { mode: 'integrated' };
    expect(paths(brief([e]))).toEqual(expect.arrayContaining(['$.elements[0].bindings[0].response.vectorMapping',
      '$.elements[0].bindings[0].response.highOrActive', '$.elements[0].bindings[0].time.speedUnit', '$.elements[0].bindings[0].time.boundaryBehavior']));
    b.source = { kind: 'native', featureId: 'waveform' };
    expect(paths(brief([e]))).toContain('$.elements[0].bindings[0].response.vectorMapping');
    delete b.response; delete b.time;
    expect(paths(brief([e]))).toEqual(expect.arrayContaining(['$.elements[0].bindings[0].response', '$.elements[0].bindings[0].time']));
  });
  it('accepts specified integrated behavior', () => {
    const e = newElement(), b = dynamic(); e.bindings = [b];
    b.time = { mode: 'integrated', speedUnit: 'radians per second', boundaryBehavior: 'wrap at two pi' };
    expect(validateContentBrief(brief([e])).status).toBe('READY_FOR_CONTRACT');
  });
  it.each([-1, NaN, Infinity, '0.1'])('rejects invalid attack/release duration %j', duration => {
    const e = newElement(), b = dynamic(); e.bindings = [b]; b.time.attackSeconds = duration; b.time.releaseSeconds = duration;
    expect(paths(brief([e]))).toEqual(expect.arrayContaining(['$.elements[0].bindings[0].time.attackSeconds', '$.elements[0].bindings[0].time.releaseSeconds']));
  });
  it('rejects unsupported source, shape, time and image enums', () => {
    const value = brief(), e = value.elements[0]; e.bindings = [dynamic()];
    e.bindings[0].source.shape = 'matrix'; e.bindings[0].time.mode = 'raf-delta';
    value.referenceImages = [{ source: 'ref.png', role: 'instruction' }];
    expect(paths(value)).toEqual(expect.arrayContaining(['$.elements[0].bindings[0].source.shape', '$.elements[0].bindings[0].time.mode', '$.referenceImages[0].role']));
    e.bindings[0].source = { kind: 'editor-event', featureId: 'range' };
    expect(paths(value)).toContain('$.elements[0].bindings[0].source.kind');
    e.bindings[0].source = { kind: 'native', featureId: 'microphone', projection: 'full' };
    expect(paths(value)).toEqual(expect.arrayContaining(['$.elements[0].bindings[0].source.featureId', '$.elements[0].bindings[0].source.projection']));
  });
  it('rejects duplicate keys/parameters and duplicate, missing or effect targets', () => {
    const value = preset(); value.elements.push({ ...value.elements[0] });
    value.elements[0].bindings.push(structuredClone(value.elements[0].bindings[0]));
    value.elements[2].targets.keys = ['rings', 'rings', 'missing', 'fade'];
    expect(paths(value)).toEqual(expect.arrayContaining(['$.elements[4].key', '$.elements[0].bindings[1].parameter',
      '$.elements[2].targets.keys[1]', '$.elements[2].targets.keys[2]', '$.elements[2].targets.keys[3]']));
  });
  it('rejects targets on visuals and timing kinds incompatible with element kinds', () => {
    const value = preset(); value.elements[0].targets = { kind: 'composition' };
    value.elements[0].timing = { kind: 'editor-range', description: 'A range' };
    value.elements[3].timing = { kind: 'manual', description: 'Whole song' };
    expect(paths(value)).toEqual(expect.arrayContaining(['$.elements[0].targets', '$.elements[0].timing.kind', '$.elements[3].timing.kind']));
  });
  it('validates supported optional preferences/references without interpreting them as instructions', () => {
    const value = brief(); value.referenceImages = [{ source: 'ref.png', role: 'priority-match' }];
    value.preferences = { palette: 'mint and black', reducedMotion: 'prefer static layout' };
    expect(validateContentBrief(value)).toMatchObject({ status: 'READY_FOR_CONTRACT', summary: { referenceImageCount: 1 } });
    value.preferences.palette = 0; value.preferences.script = 'run()';
    expect(paths(value)).toEqual(expect.arrayContaining(['$.preferences.palette', '$.preferences.script']));
  });
  it.each([null, [], 'brief', { schemaVersion: 1, kind: 'preset', intent: 'x', elements: [null] },
    { schemaVersion: 1, kind: 'preset', intent: 'x', elements: [{ bindings: [null] }] }])('returns errors for malformed shape %j without throwing', value => {
    expect(validateContentBrief(value).status).toBe('INPUT_INCOMPLETE');
  });
});

describe('content brief CLI', () => {
  it.each([brief(), { schemaVersion: 1 }])('has no file side effects on success or failure', value => {
    const directory = temporaryDirectory(), input = join(directory, 'brief.json');
    const serialized = JSON.stringify(value); writeFileSync(input, serialized, 'utf8');
    const result = runCli([input], directory);
    expect(result.exitCode).toBe(value.intent ? 0 : 2);
    expect(result.output.status).toBe(value.intent ? 'READY_FOR_CONTRACT' : 'INPUT_INCOMPLETE');
    expect(readFileSync(input, 'utf8')).toBe(serialized);
    expect(readdirSync(directory)).toEqual(['brief.json']);
  });
  it('returns exit 2 for missing/extra arguments, missing files and malformed JSON', () => {
    const directory = temporaryDirectory(), input = join(directory, 'brief.json');
    writeFileSync(input, '{invalid', 'utf8');
    for (const args of [[], [input, input], [join(directory, 'missing.json')], [input]]) {
      const result = runCli(args, directory);
      expect(result.exitCode).toBe(2); expect(result.output.status).toBe('INPUT_INCOMPLETE');
      expect(result.output.errors[0].path).toBe('$');
    }
    expect(readFileSync(input, 'utf8')).toBe('{invalid');
    expect(readdirSync(directory)).toEqual(['brief.json']);
  });
  it('does not execute CLI when imported', () => {
    const directory = temporaryDirectory();
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(validatorUrl.href)})`],
      { cwd: directory, encoding: 'utf8', windowsHide: true });
    expect(result.status).toBe(0); expect(result.stdout).toBe(''); expect(result.stderr).toBe('');
    expect(readdirSync(directory)).toEqual([]);
  });
});
