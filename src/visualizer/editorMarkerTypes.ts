import type { PointEventV1, RangeEventV1 } from '../editor/types';

export interface MarkerInputContract {
    id: string;
    eventKind: 'point' | 'range';
    selectionModes: Array<'single' | 'collection'>;
}
export interface MarkerInputDefinition extends MarkerInputContract {
    label: string;
}
export type MarkerBinding =
    | { kind: 'unbound' }
    | { kind: 'single'; laneId: string; eventId: string }
    | { kind: 'collection'; laneId: string; innerClassIds?: string[] };
export type MarkerBindings = Record<string, MarkerBinding>;
export interface MarkerQuery {
    inputId: string;
    startSeconds?: number;
    endSeconds?: number;
    cursor?: string;
}
export interface MarkerPage {
    eventKind: 'point' | 'range';
    events: Array<PointEventV1 | RangeEventV1>;
    nextCursor: string | null;
}
export type MarkerReader = (elementId: string, query: MarkerQuery) => Promise<MarkerPage>;
