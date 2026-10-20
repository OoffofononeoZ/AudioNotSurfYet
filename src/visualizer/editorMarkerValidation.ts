import { invalid, keys, record, text } from './projectValidation';
import type { EditorProjectV1 } from '../editor/types';
import type { MarkerBindings, MarkerInputContract, MarkerInputDefinition } from './editorMarkerTypes';

export function validateMarkerInputs(input: unknown): MarkerInputContract[] {
    if (!Array.isArray(input) || !input.length) return invalid('标记输入声明必须为非空列表。');
    const ids = new Set<string>();
    return input.map(raw => {
        const v = record(raw, '标记输入');
        keys(v, ['id', 'eventKind', 'selectionModes'], ['categorySelection']);
        const id = text(v.id, '标记输入 ID');
        if (
            !/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(id) ||
            ['__proto__', 'prototype', 'constructor'].includes(id) ||
            ids.has(id)
        )
            return invalid('标记输入 ID 无效或重复。');
        ids.add(id);
        if (
            !['point', 'range'].includes(String(v.eventKind)) ||
            !Array.isArray(v.selectionModes) ||
            !v.selectionModes.length ||
            new Set(v.selectionModes).size !== v.selectionModes.length ||
            v.selectionModes.some(m => !['single', 'collection'].includes(m))
        )
            return invalid('标记输入类型或选择模式无效。');
        if (
            v.categorySelection !== undefined &&
            (v.categorySelection !== 'single' || !v.selectionModes.includes('collection'))
        )
            return invalid('单分类约束只允许集合输入。');
        return {
            id,
            eventKind: v.eventKind,
            selectionModes: [...v.selectionModes],
            ...(v.categorySelection === 'single' ? { categorySelection: 'single' } : {}),
        } as MarkerInputContract;
    });
}
export function validateMarkerDefinitions(
    input: unknown,
    contracts?: MarkerInputContract[],
): MarkerInputDefinition[] | undefined {
    if (!contracts) {
        if (input !== undefined) invalid('算法未声明标记输入。');
        return undefined;
    }
    if (!Array.isArray(input) || input.length !== contracts.length) return invalid('元素标记输入定义不完整。');
    return contracts.map((contract, index) => {
        const v = record(input[index], '元素标记输入');
        keys(v, ['id', 'eventKind', 'selectionModes', 'label'], ['categorySelection']);
        const entry = validateMarkerInputs([
            {
                id: v.id,
                eventKind: v.eventKind,
                selectionModes: v.selectionModes,
                ...(v.categorySelection !== undefined ? { categorySelection: v.categorySelection } : {}),
            },
        ])[0]!;
        if (
            entry.id !== contract.id ||
            entry.eventKind !== contract.eventKind ||
            (contract.categorySelection === 'single' && entry.categorySelection !== 'single') ||
            entry.selectionModes.some(m => !contract.selectionModes.includes(m))
        )
            return invalid('元素标记输入超出算法声明。');
        return { ...entry, label: text(v.label, '标记输入标签') };
    });
}
export function defaultMarkerBindings(
    inputs?: MarkerInputDefinition[],
    timingInput?: string,
): MarkerBindings | undefined {
    const selected = inputs?.filter(i => i.id !== timingInput) ?? [];
    return selected.length ? Object.fromEntries(selected.map(i => [i.id, { kind: 'unbound' as const }])) : undefined;
}
export function validateMarkerBindings(
    input: unknown,
    inputs: MarkerInputDefinition[] | undefined,
    timingInput: string | undefined,
    editor?: EditorProjectV1,
    packageOnly = false,
): MarkerBindings | undefined {
    const selected = inputs?.filter(i => i.id !== timingInput) ?? [];
    if (!selected.length) {
        if (input !== undefined) invalid('此元素不接受独立标记绑定。');
        return undefined;
    }
    const value = record(input, '标记绑定');
    keys(
        value,
        selected.map(i => i.id),
    );
    return Object.fromEntries(
        selected.map(descriptor => {
            const v = record(value[descriptor.id], '标记绑定');
            if (v.kind === 'unbound') {
                keys(v, ['kind']);
                return [descriptor.id, { kind: 'unbound' }];
            }
            if (packageOnly) return invalid('资源包不能保存实际工程的标记引用。');
            if (!descriptor.selectionModes.includes(v.kind as 'single' | 'collection'))
                return invalid('标记选择模式不受支持。');
            const laneId = text(v.laneId, '标记轨道'),
                lane = editor?.lanes.find(l => l.id === laneId);
            if (!lane || lane.eventKind !== descriptor.eventKind)
                return invalid('标记轨道缺失或类型不匹配：' + descriptor.label);
            if (v.kind === 'single') {
                keys(v, ['kind', 'laneId', 'eventId']);
                const eventId = text(v.eventId, '标记 ID');
                if (!lane.events.some(e => e.id === eventId)) return invalid('所选标记已失效：' + descriptor.label);
                return [descriptor.id, { kind: 'single', laneId, eventId }];
            }
            keys(v, ['kind', 'laneId'], ['innerClassIds']);
            if (
                descriptor.categorySelection === 'single' &&
                (!Array.isArray(v.innerClassIds) || v.innerClassIds.length !== 1)
            )
                return invalid('标记输入必须选择一个分类：' + descriptor.label);
            if (
                v.innerClassIds !== undefined &&
                (!Array.isArray(v.innerClassIds) ||
                    !v.innerClassIds.length ||
                    new Set(v.innerClassIds).size !== v.innerClassIds.length ||
                    v.innerClassIds.some(id => !lane.innerClasses.some(c => c.id === id)))
            )
                return invalid('所选标记分类已失效：' + descriptor.label);
            return [
                descriptor.id,
                {
                    kind: 'collection',
                    laneId,
                    ...(v.innerClassIds !== undefined ? { innerClassIds: [...(v.innerClassIds as string[])] } : {}),
                },
            ];
        }),
    ) as MarkerBindings;
}
