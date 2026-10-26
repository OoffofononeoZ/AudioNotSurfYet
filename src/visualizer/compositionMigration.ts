import { record } from './projectValidation';
import { migrateLegacySeeds } from './seedMigration';

/** Explicit version conversion at input boundaries. Resource snapshots are never rebound or rewritten. */
export function migrateCompositionV5(input: unknown): unknown {
    const v = record(migrateLegacySeeds(input), '工程');
    if (v.format !== 'audiosurf-visualizer' || v.schemaVersion !== 5) return v;
    return { ...structuredClone(v), schemaVersion: 6 };
}
export function migrateRealtimeStyleV1(input: unknown): unknown {
    const v = record(migrateLegacySeeds(input), '实时样式');
    if (v.format !== 'audiosurf-realtime-style' || v.schemaVersion !== 1) return v;
    return { ...structuredClone(v), schemaVersion: 2 };
}
