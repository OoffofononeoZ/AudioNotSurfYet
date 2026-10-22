import { record, invalid } from './projectValidation';
import { validateSeed } from './seed';
import { validateResourceRef, validateResourceSnapshot } from './resourceCodec';
import { resourceHash, resourceKey, resourceRef } from './resourceIdentity';
import { legacySeedCapabilities } from './legacySeedCapabilities';
import type { ResourceRef } from './resourceTypes';

const owns = (input: object, key: string) => Object.prototype.hasOwnProperty.call(input, key);
export const hasLegacySeed = (input: unknown): boolean =>
    typeof input === 'object' && input !== null && owns(input, 'seed');

/** Explicit input migration only. Rendering never dispatches by resource IDs or old seeds. */
export function migrateLegacySeeds(input: unknown): unknown {
    if (!hasLegacySeed(input)) return input;
    const original = record(input, '旧 Seed 工程'),
        seed = validateSeed(original.seed);
    if (!Array.isArray(original.elements)) return invalid('elements 必须为列表。');
    if (original.elements.some(e => owns(record(e, '元素'), 'seed'))) return invalid('不能混用全局 Seed 和元素 Seed。');
    const result = structuredClone(original),
        resources = validateResourceSnapshot(result.resources);
    const refs = new Map<string, ResourceRef>();
    const replace = (ref: ResourceRef) => refs.get(resourceKey(ref)) ?? ref;
    resources.elements = resources.elements.map(definition => {
        if (definition.usesSeed) return definition;
        const key = resourceKey(definition.algorithm);
        if (!owns(legacySeedCapabilities, key))
            return invalid('旧自定义资源缺少可确认的 Seed 能力声明，请更新资源后重试。');
        if (!legacySeedCapabilities[key]) return definition;
        const next = { ...definition, version: definition.version + 1, usesSeed: true as const };
        next.hash = resourceHash(next);
        refs.set(resourceKey(definition), resourceRef(next));
        return next;
    });
    resources.presets = resources.presets.map(definition => {
        if (!definition.elements.some(e => refs.has(resourceKey(e.element)))) return definition;
        const next = {
            ...definition,
            version: definition.version + 1,
            elements: definition.elements.map(e => ({ ...e, element: replace(e.element) })),
        };
        next.hash = resourceHash(next);
        refs.set(resourceKey(definition), resourceRef(next));
        return next;
    });
    result.elements = original.elements.map(input => {
        const e = record(input, '元素'),
            resource = replace(validateResourceRef(e.resource));
        const definition = resources.elements.find(d => resourceKey(d) === resourceKey(resource));
        if (!definition) return invalid('元素定义缺失。');
        return { ...e, resource, ...(definition.usesSeed ? { seed } : {}) };
    });
    if (Array.isArray(result.items))
        result.items = result.items.map(input => {
            const item = record(input, '组合项');
            return item.kind === 'preset' ? { ...item, resource: replace(validateResourceRef(item.resource)) } : item;
        });
    result.resources = validateResourceSnapshot(resources);
    delete result.seed;
    return result;
}
