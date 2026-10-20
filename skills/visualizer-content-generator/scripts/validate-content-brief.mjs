#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREFERENCES = [
    'palette',
    'background',
    'camera',
    'density',
    'motionRhythm',
    'reducedMotion',
    'targetFixture',
    'performancePriority',
];
const incomplete = errors => ({ status: 'INPUT_INCOMPLETE', errors });

/** Validates intake semantics only; registry and rendering feasibility belong to the contract. */
export function validateContentBrief(input) {
    const errors = [];
    const issue = (path, message) => errors.push({ path, message });
    const object = (value, allowed, path) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            issue(path, 'must be an object');
            return null;
        }
        for (const key of Object.keys(value)) if (!allowed.includes(key)) issue(`${path}.${key}`, 'unknown field');
        return value;
    };
    const text = (value, path) => {
        if (typeof value !== 'string' || !value.trim()) {
            issue(path, 'must be a non-empty string');
            return false;
        }
        return true;
    };
    const name = (value, path) => {
        if (text(value, path) && !NAME.test(value)) issue(path, 'must be a kebab-case name');
    };
    const enumeration = (value, options, path) => {
        if (!options.includes(value)) issue(path, `must be ${options.join(', ')}`);
    };
    const array = (value, path) => {
        if (!Array.isArray(value)) {
            issue(path, 'must be an array');
            return null;
        }
        return value;
    };

    function time(value, path) {
        const t = object(value, ['mode', 'attackSeconds', 'releaseSeconds', 'speedUnit', 'boundaryBehavior'], path);
        if (!t) return;
        enumeration(t.mode, ['direct', 'attack-release', 'integrated'], `${path}.mode`);
        for (const key of ['attackSeconds', 'releaseSeconds']) {
            if (t[key] !== undefined && (typeof t[key] !== 'number' || !Number.isFinite(t[key]) || t[key] < 0)) {
                issue(`${path}.${key}`, 'must be a finite number greater than or equal to 0');
            }
        }
        for (const key of ['speedUnit', 'boundaryBehavior']) {
            if (t.mode === 'integrated' || t[key] !== undefined) text(t[key], `${path}.${key}`);
        }
    }

    function response(value, vector, path) {
        const r = object(value, ['lowOrInactive', 'highOrActive', 'vectorMapping'], path);
        if (!r) return;
        text(r.lowOrInactive, `${path}.lowOrInactive`);
        text(r.highOrActive, `${path}.highOrActive`);
        if (vector || r.vectorMapping !== undefined) text(r.vectorMapping, `${path}.vectorMapping`);
    }

    function binding(value, path) {
        const b = object(value, ['parameter', 'drivenProperty', 'source', 'response', 'time'], path);
        if (!b) return;
        text(b.parameter, `${path}.parameter`);
        text(b.drivenProperty, `${path}.drivenProperty`);
        const kind = b.source?.kind;
        const keys =
            kind === 'constant'
                ? ['kind', 'value']
                : kind === 'analysis'
                  ? ['kind', 'shape']
                  : kind === 'unbound'
                    ? ['kind']
                    : ['kind', 'featureId'];
        const source = object(b.source, keys, `${path}.source`);
        if (!source) return;
        enumeration(kind, ['constant', 'analysis', 'native', 'unbound'], `${path}.source.kind`);
        if (kind === 'constant') {
            const v = source.value;
            const valid =
                typeof v === 'string' ||
                typeof v === 'boolean' ||
                (typeof v === 'number' && Number.isFinite(v)) ||
                (Array.isArray(v) && v.every(n => typeof n === 'number' && Number.isFinite(n)));
            if (!valid)
                issue(`${path}.source.value`, 'must be a string, boolean, finite number, or finite numeric array');
            if (b.response !== undefined)
                issue(`${path}.response`, 'constant sources do not have low/high response semantics');
            if (b.time !== undefined) time(b.time, `${path}.time`);
        } else if (kind === 'unbound') {
            if (b.response !== undefined) issue(`${path}.response`, 'unbound sources do not define a response yet');
            if (b.time !== undefined) issue(`${path}.time`, 'unbound sources do not define time behavior yet');
        } else if (kind === 'analysis' || kind === 'native') {
            if (kind === 'analysis') enumeration(source.shape, ['scalar', 'vector'], `${path}.source.shape`);
            else enumeration(source.featureId, ['frequency', 'waveform'], `${path}.source.featureId`);
            response(b.response, kind === 'native' || source.shape === 'vector', `${path}.response`);
            time(b.time, `${path}.time`);
        }
    }

    const brief = object(
        input,
        [
            'schemaVersion',
            'kind',
            'intent',
            'elements',
            'commonControls',
            'requestedName',
            'referenceImages',
            'preferences',
        ],
        '$',
    );
    if (!brief) return incomplete(errors);
    if (brief.schemaVersion !== 2) issue('$.schemaVersion', 'must equal 2; V1 intake is not supported');
    enumeration(brief.kind, ['element', 'preset'], '$.kind');
    text(brief.intent, '$.intent');
    if (brief.requestedName !== undefined) text(brief.requestedName, '$.requestedName');

    const elements = array(brief.elements, '$.elements') ?? [];
    if (Array.isArray(brief.elements) && !elements.length) issue('$.elements', 'must contain at least one element');
    if (brief.kind === 'element' && (elements.length !== 1 || elements[0]?.origin !== 'new')) {
        issue('$.elements', 'element mode requires exactly one new element');
    }
    const byKey = new Map();
    const references = [];
    let newElementCount = 0;
    let bindingCount = 0;
    elements.forEach((value, index) => {
        const path = `$.elements[${index}]`;
        const e = object(
            value,
            [
                'key',
                'origin',
                'resource',
                'markerInputs',
                'timingInput',
                'type',
                'kind',
                'appearance',
                'spatialStructure',
                'motion',
                'bindings',
                'timing',
                'targets',
            ],
            path,
        );
        if (!e) return;
        name(e.key, `${path}.key`);
        name(e.type, `${path}.type`);
        enumeration(e.origin, ['existing', 'new'], `${path}.origin`);
        if (brief.kind === 'preset' && e.origin !== 'existing')
            issue(
                `${path}.origin`,
                'presets may only reference existing elements; approve and create missing elements first',
            );
        if (e.origin === 'existing') {
            const ref = object(e.resource, ['id', 'version', 'hash'], `${path}.resource`);
            if (ref) {
                if (ref.id !== e.type) issue(`${path}.resource.id`, 'must equal the existing element type');
                if (!Number.isSafeInteger(ref.version) || ref.version < 1)
                    issue(`${path}.resource.version`, 'must be a positive safe integer');
                if (typeof ref.hash !== 'string' || !/^[a-f0-9]{64}$/.test(ref.hash))
                    issue(`${path}.resource.hash`, 'must be an exact SHA-256');
            }
        } else if (e.resource !== undefined) issue(`${path}.resource`, 'new elements do not have an existing identity');
        enumeration(e.kind, ['visual', 'modifier', 'transition'], `${path}.kind`);
        if (typeof e.key === 'string') {
            if (byKey.has(e.key)) issue(`${path}.key`, 'duplicate element key');
            else byKey.set(e.key, e);
        }
        if (e.origin === 'new') newElementCount++;
        const markerInputs = e.markerInputs === undefined ? [] : (array(e.markerInputs, `${path}.markerInputs`) ?? []);
        const markerById = new Map();
        markerInputs.forEach((raw, i) => {
            const inputPath = `${path}.markerInputs[${i}]`,
                m = object(raw, ['id', 'eventKind', 'selectionModes', 'purpose', 'response'], inputPath);
            if (!m) return;
            name(m.id, `${inputPath}.id`);
            if (markerById.has(m.id)) issue(`${inputPath}.id`, 'duplicate marker input ID');
            markerById.set(m.id, m);
            enumeration(m.eventKind, ['point', 'range'], `${inputPath}.eventKind`);
            const modes = array(m.selectionModes, `${inputPath}.selectionModes`) ?? [];
            if (!modes.length || new Set(modes).size !== modes.length)
                issue(`${inputPath}.selectionModes`, 'must be a nonempty unique selection mode list');
            modes.forEach((mode, j) =>
                enumeration(mode, ['single', 'collection'], `${inputPath}.selectionModes[${j}]`),
            );
            text(m.purpose, `${inputPath}.purpose`);
            text(m.response, `${inputPath}.response`);
        });
        if (e.timingInput !== undefined) {
            const marker = markerById.get(e.timingInput);
            if (
                e.kind !== 'transition' ||
                marker?.eventKind !== 'range' ||
                marker.selectionModes?.length !== 1 ||
                marker.selectionModes[0] !== 'single'
            )
                issue(`${path}.timingInput`, 'must reference a declared single-range input on a transition');
        }
        for (const key of ['appearance', 'spatialStructure', 'motion']) {
            if (e.origin === 'new' || e[key] !== undefined) text(e[key], `${path}.${key}`);
        }
        if (e.bindings !== undefined) {
            const bindings = array(e.bindings, `${path}.bindings`) ?? [];
            const parameters = new Set();
            bindingCount += bindings.length;
            bindings.forEach((b, i) => {
                const bindingPath = `${path}.bindings[${i}]`;
                binding(b, bindingPath);
                if (typeof b?.parameter === 'string') {
                    if (parameters.has(b.parameter)) issue(`${bindingPath}.parameter`, 'duplicate parameter intent');
                    parameters.add(b.parameter);
                }
            });
        }
        if (e.timing !== undefined) {
            const t = object(
                e.timing,
                e.timing?.kind === 'unbound' ? ['kind'] : ['kind', 'description'],
                `${path}.timing`,
            );
            if (t) {
                enumeration(
                    t.kind,
                    e.kind === 'transition' ? ['editor-range', 'unbound'] : ['manual'],
                    `${path}.timing.kind`,
                );
                if (t.kind !== 'unbound') text(t.description, `${path}.timing.description`);
            }
        }
        if (e.targets !== undefined) {
            if (e.kind === 'visual') issue(`${path}.targets`, 'visual elements cannot have effect targets');
            const t = object(
                e.targets,
                e.targets?.kind === 'composition' ? ['kind'] : ['kind', 'keys'],
                `${path}.targets`,
            );
            if (t) {
                enumeration(t.kind, ['composition', 'elements'], `${path}.targets.kind`);
                if (t.kind === 'elements') {
                    const keys = array(t.keys, `${path}.targets.keys`) ?? [];
                    const seen = new Set();
                    keys.forEach((key, i) => {
                        const keyPath = `${path}.targets.keys[${i}]`;
                        name(key, keyPath);
                        if (seen.has(key)) issue(keyPath, 'duplicate target key');
                        seen.add(key);
                        references.push({ key, path: keyPath });
                    });
                }
            }
        }
    });
    for (const ref of references) {
        const target = byKey.get(ref.key);
        if (!target) issue(ref.path, 'target must reference a declared element key');
        else if (target.kind !== 'visual') issue(ref.path, 'effects may target only visual elements');
    }

    if (brief.commonControls !== undefined) {
        if (brief.kind !== 'preset') issue('$.commonControls', 'only presets declare common controls');
        const controls = array(brief.commonControls, '$.commonControls') ?? [];
        const seen = new Set();
        controls.forEach((value, index) => {
            const path = `$.commonControls[${index}]`;
            const c = object(
                value,
                ['key', 'label', 'kind', 'parameter', 'field', 'targets', 'intent', 'defaultValue'],
                path,
            );
            if (!c) return;
            name(c.key, `${path}.key`);
            if (seen.has(c.key)) issue(`${path}.key`, 'duplicate common control key');
            seen.add(c.key);
            for (const key of ['label', 'parameter', 'intent']) text(c[key], `${path}.${key}`);
            enumeration(c.kind, ['value', 'binding', 'transform'], `${path}.kind`);
            if (c.kind === 'transform')
                enumeration(
                    c.field,
                    [
                        'inputMin',
                        'inputMax',
                        'outputMin',
                        'outputMax',
                        'clamp',
                        'invert',
                        'attackSeconds',
                        'releaseSeconds',
                    ],
                    `${path}.field`,
                );
            else if (c.field !== undefined) issue(`${path}.field`, 'only transform controls declare a field');
            const targets = array(c.targets, `${path}.targets`) ?? [];
            if (!targets.length) issue(`${path}.targets`, 'must select at least one child');
            const unique = new Set();
            targets.forEach((key, i) => {
                if (!byKey.has(key)) issue(`${path}.targets[${i}]`, 'must reference a declared element key');
                if (unique.has(key)) issue(`${path}.targets[${i}]`, 'duplicate target key');
                unique.add(key);
            });
            if (
                c.defaultValue !== undefined &&
                !(
                    (typeof c.defaultValue === 'number' && Number.isFinite(c.defaultValue)) ||
                    typeof c.defaultValue === 'boolean'
                )
            )
                issue(
                    `${path}.defaultValue`,
                    'must be a finite processing number or boolean; input defaults belong to element binding intents',
                );
            if (
                ['x', 'y', 'width', 'height', 'size', 'radius', 'color', 'opacity', 'thickness'].includes(
                    c.parameter,
                ) &&
                c.kind === 'value'
            )
                issue(`${path}.parameter`, 'style values cannot be common processing controls');
        });
    }

    if (brief.referenceImages !== undefined) {
        const images = array(brief.referenceImages, '$.referenceImages') ?? [];
        images.forEach((value, index) => {
            const path = `$.referenceImages[${index}]`;
            const img = object(value, ['source', 'role'], path);
            if (!img) return;
            text(img.source, `${path}.source`);
            enumeration(img.role, ['inspiration', 'priority-match'], `${path}.role`);
        });
    }
    if (brief.preferences !== undefined) {
        const preferences = object(brief.preferences, PREFERENCES, '$.preferences');
        if (preferences)
            for (const key of PREFERENCES)
                if (preferences[key] !== undefined) text(preferences[key], `$.preferences.${key}`);
    }
    if (errors.length) return incomplete(errors);
    return {
        status: 'READY_FOR_CONTRACT',
        errors: [],
        summary: {
            kind: brief.kind,
            elementCount: elements.length,
            newElementCount,
            bindingCount,
            referenceImageCount: brief.referenceImages?.length ?? 0,
        },
    };
}

function main() {
    let result;
    if (process.argv.length !== 3) {
        result = incomplete([{ path: '$', message: 'usage: validate-content-brief.mjs <brief.json>' }]);
    } else {
        try {
            result = validateContentBrief(JSON.parse(readFileSync(process.argv[2], 'utf8')));
        } catch (error) {
            result = incomplete([
                {
                    path: '$',
                    message: `cannot read valid JSON: ${error instanceof Error ? error.message : String(error)}`,
                },
            ]);
        }
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'INPUT_INCOMPLETE') process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
