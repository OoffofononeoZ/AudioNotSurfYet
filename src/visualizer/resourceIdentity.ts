import { hashBytes } from '../processing/sha256';
import type { ResourceRef } from './resourceTypes';

/** JSON object key order must not change a resource's content identity. */
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    const object = value as Record<string, unknown>;
    return (
        '{' +
        Object.keys(object)
            .sort()
            .map(key => JSON.stringify(key) + ':' + canonicalJson(object[key]))
            .join(',') +
        '}'
    );
}
export function resourceHash(value: object): string {
    const { hash: _hash, ...payload } = value as Record<string, unknown>;
    return hashBytes(new TextEncoder().encode(canonicalJson(payload)));
}
export const resourceRef = ({ id, version, hash }: ResourceRef): ResourceRef => ({ id, version, hash });
export const resourceKey = (ref: ResourceRef) => `${ref.id}@${ref.version}:${ref.hash}`;
export const sameResource = (a: ResourceRef, b: ResourceRef) => resourceKey(a) === resourceKey(b);
