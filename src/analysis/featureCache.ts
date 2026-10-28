import { decodeAnalysisSeries, encodeAnalysisSeries } from './compactCodec';
import { createAnalysisCacheKey } from './config';
import type { AnalysisSeries, FeatureId } from './types';
import type { StoredAnalysisCache } from '../types/session';

/** Current song only; active features own slots, unused slots retain recent results. */
export class AnalysisFeatureCache {
    private identity: { trackId: string; trackHash: string; configHash: string } | null = null;
    private entries = new Map<FeatureId, { series?: AnalysisSeries; payload?: ArrayBuffer }>();
    private active: readonly FeatureId[] = [];
    revision = 0;
    persistedRevision = 0;
    matches(identity: { trackId: string; trackHash: string; configHash: string }): boolean {
        return (
            this.identity?.trackId === identity.trackId &&
            this.identity.trackHash === identity.trackHash &&
            this.identity.configHash === identity.configHash
        );
    }
    clear(): void {
        this.identity = null;
        this.entries.clear();
        this.revision++;
    }
    select(identity: NonNullable<AnalysisFeatureCache['identity']>, active: readonly FeatureId[]): void {
        if (JSON.stringify(this.identity) !== JSON.stringify(identity)) this.clear();
        this.identity = identity;
        this.active = active;
    }
    restore(cache: StoredAnalysisCache | undefined): void {
        this.clear();
        if (cache) {
            this.identity = {
                trackId: cache.manifest.trackId,
                trackHash: cache.manifest.trackHash,
                configHash: cache.manifest.configHash,
            };
            for (const id of cache.manifest.featureIds.slice(0, 4)) {
                const key = createAnalysisCacheKey(this.identity.trackHash, this.identity.configHash, id);
                const payload = cache.payloads.find(entry => entry.cacheKey === key)?.payload;
                if (payload) this.entries.set(id, { payload });
            }
        }
        this.persistedRevision = this.revision;
    }
    get(id: FeatureId): AnalysisSeries | null {
        const entry = this.entries.get(id),
            identity = this.identity;
        if (!entry || !identity) return null;
        try {
            entry.series ??= decodeAnalysisSeries(entry.payload!, {
                trackHash: identity.trackHash,
                configHash: identity.configHash,
                featureId: id,
            });
            this.entries.delete(id);
            this.entries.set(id, entry);
            return entry.series;
        } catch {
            this.entries.delete(id);
            this.revision++;
            return null;
        }
    }
    put(series: AnalysisSeries): void {
        if (
            !this.identity ||
            series.trackHash !== this.identity.trackHash ||
            series.configHash !== this.identity.configHash
        )
            return;
        if (this.entries.get(series.featureId)?.series === series) return;
        this.entries.delete(series.featureId);
        while (this.entries.size >= 4) {
            const victim = [...this.entries.keys()].find(id => !this.active.includes(id));
            if (!victim) throw new Error('Active analysis cache exceeded four features.');
            this.entries.delete(victim);
        }
        this.entries.set(series.featureId, { series });
        this.revision++;
    }
    stored(): StoredAnalysisCache | null {
        if (!this.identity || !this.entries.size) return null;
        const featureIds = [...this.entries.keys()];
        const payloads = featureIds.map(featureId => {
            const entry = this.entries.get(featureId)!;
            entry.payload ??= encodeAnalysisSeries(entry.series!);
            return {
                cacheKey: createAnalysisCacheKey(this.identity!.trackHash, this.identity!.configHash, featureId),
                payload: entry.payload,
            };
        });
        return { manifest: { ...this.identity, featureIds, cacheKeys: payloads.map(p => p.cacheKey) }, payloads };
    }
}
