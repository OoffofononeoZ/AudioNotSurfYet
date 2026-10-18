export interface ContentBriefResult {
    status: 'INPUT_INCOMPLETE' | 'READY_FOR_CONTRACT';
    errors: Array<{ path: string; message: string }>;
    summary?: {
        kind: 'element' | 'preset';
        elementCount: number;
        newElementCount: number;
        bindingCount: number;
        referenceImageCount: number;
    };
}
export function validateContentBrief(input: unknown): ContentBriefResult;
