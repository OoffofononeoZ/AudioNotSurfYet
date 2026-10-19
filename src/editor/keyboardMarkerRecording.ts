import type { PlaybackSnapshot } from '../types/audio';
import type { EditorBeatSnapSetting } from './beatSnap';
import { createPointEvent, pointCellAtTime } from './pointAnnotations';
import { createRangeEvent, nextRangeCell } from './rangeAnnotations';
import type { EditorProjectV1 } from './types';

export interface KeyboardMarkerTarget {
    key: string;
    laneId: string;
    innerClassId: string;
    eventKind: 'point' | 'range';
}

export interface KeyboardRecordingContext {
    trackId: string;
    project: EditorProjectV1;
    revision: number;
}

export interface KeyboardRecordingHost {
    getContext(): KeyboardRecordingContext | null;
    publish(project: EditorProjectV1): void;
}

export interface KeyboardRangeRecording extends KeyboardMarkerTarget {
    code: string;
    startSeconds: number;
    signature: string;
}

export function keyboardMarkerTargets(project: EditorProjectV1): KeyboardMarkerTarget[] {
    return project.lanes
        .flatMap(lane =>
            lane.innerClasses.map(category => ({
                laneId: lane.id,
                innerClassId: category.id,
                eventKind: lane.eventKind,
            })),
        )
        .slice(0, 10)
        .map((row, index) => ({ ...row, key: String((index + 1) % 10) }));
}

export function keyboardRecordingSignature(context: KeyboardRecordingContext, setting: EditorBeatSnapSetting): string {
    return JSON.stringify([
        context.trackId,
        context.revision,
        context.project.projectId,
        context.project.track,
        context.project.tempoMap,
        keyboardMarkerTargets(context.project),
        setting,
    ]);
}

interface RecorderOptions extends KeyboardRecordingHost {
    active(): boolean;
    playback(): PlaybackSnapshot;
    setting(): EditorBeatSnapSetting;
    report(message: string): void;
    changed(pending: readonly KeyboardRangeRecording[]): void;
}

/** Runtime-only recording; event writes always start from the host's latest project. */
export class KeyboardMarkerRecorder {
    private held = new Map<string, string>();
    private pending = new Map<string, KeyboardRangeRecording>();

    private options: RecorderOptions;

    constructor(options: RecorderOptions) {
        this.options = options;
    }

    private context(snapshot: PlaybackSnapshot): KeyboardRecordingContext | null {
        const context = this.options.getContext();
        return this.options.active() && context?.trackId === snapshot.trackId ? context : null;
    }

    private changed(): void {
        this.options.changed([...this.pending.values()]);
    }

    cancel(releaseKeys = false): void {
        this.pending.clear();
        if (releaseKeys) this.held.clear();
        this.changed();
    }

    reconcile(): void {
        const context = this.context(this.options.playback());
        if (
            !context ||
            [...this.pending.values()].some(
                range => range.signature !== keyboardRecordingSignature(context, this.options.setting()),
            )
        )
            this.cancel();
    }

    down(key: string, code: string, repeat = false): boolean {
        const snapshot = this.options.playback();
        const context = this.context(snapshot);
        const target = context && keyboardMarkerTargets(context.project).find(row => row.key === key);
        if (!context || !target || snapshot.state !== 'playing') return false;
        if (repeat || this.held.has(code)) return true;
        const alreadyHeld = [...this.held.values()].includes(key);
        this.held.set(code, key);
        if (alreadyHeld) return true;
        // Candidate selection is independent of pixel width; this entry has no pointer geometry.
        const cell = pointCellAtTime(snapshot.currentTimeSeconds, context.project, 1, this.options.setting());
        if (!cell) {
            this.options.report('当前区间没有可用节拍，请先设置 BPM。');
            return true;
        }
        if (target.eventKind === 'range') {
            this.pending.set(key, {
                ...target,
                code,
                startSeconds: cell.timeSeconds,
                signature: keyboardRecordingSignature(context, this.options.setting()),
            });
            this.changed();
        } else {
            try {
                this.options.publish(
                    createPointEvent(context.project, target.laneId, target.innerClassId, cell.timeSeconds).project,
                );
                this.options.report(`已添加 ${cell.timeSeconds.toFixed(3)} 秒标记。`);
            } catch (error) {
                this.options.report(this.errorMessage(error));
            }
        }
        return true;
    }

    up(code: string): boolean {
        const key = this.held.get(code);
        if (key === undefined) return false;
        this.held.delete(code);
        const range = this.pending.get(key);
        if (range?.code === code) {
            this.pending.delete(key);
            this.finish([range], this.options.playback(), true);
            this.changed();
        }
        return true;
    }

    playbackChanged(snapshot: PlaybackSnapshot): void {
        if (!this.pending.size) return;
        if (snapshot.state === 'paused' || snapshot.state === 'ended') {
            const ranges = [...this.pending.values()];
            this.pending.clear();
            this.finish(ranges, snapshot, false);
            this.changed();
        } else if (snapshot.state !== 'playing' || !this.context(snapshot)) this.cancel();
    }

    private finish(ranges: KeyboardRangeRecording[], snapshot: PlaybackSnapshot, extend: boolean): void {
        const context = this.context(snapshot);
        if (!context || !['playing', 'paused', 'ended'].includes(snapshot.state)) return;
        const setting = this.options.setting();
        const signature = keyboardRecordingSignature(context, setting);
        let project = context.project,
            created = 0;
        const errors: string[] = [];
        for (const range of ranges) {
            if (range.signature !== signature) continue;
            try {
                const cell = pointCellAtTime(snapshot.currentTimeSeconds, project, 1, setting);
                const minimum = nextRangeCell(range.startSeconds, project, 1, setting)?.timeSeconds;
                if (
                    !cell ||
                    minimum === undefined ||
                    minimum <= range.startSeconds ||
                    minimum > project.track.durationSeconds
                )
                    throw new Error('没有歌曲范围内的合法终点，未创建范围。');
                const end = extend ? Math.max(cell.timeSeconds, minimum) : cell.timeSeconds;
                if (end < minimum) throw new Error('范围不足一格，未创建。');
                project = createRangeEvent(
                    project,
                    range.laneId,
                    range.innerClassId,
                    range.startSeconds,
                    end,
                    undefined,
                    minimum,
                ).project;
                created += 1;
            } catch (error) {
                errors.push(this.errorMessage(error));
            }
        }
        if (created) this.options.publish(project);
        this.options.report([created ? `已添加 ${created} 个范围标记。` : '', ...errors].filter(Boolean).join(' '));
    }

    private errorMessage(error: unknown): string {
        return error instanceof Error ? error.message : '无法添加标记。';
    }
}
