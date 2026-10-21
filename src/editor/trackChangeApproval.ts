import type { EditorProjectV2 } from './types';

/** A runtime-only approval bound to one destination and the exact source revision. */
export class EditorTrackChangeApproval {
    private pending: { token: symbol; target: string | null; project: EditorProjectV2 | null } | null = null;

    issue(target: string | null, project: EditorProjectV2 | null): symbol {
        const token = Symbol('editor-track-change');
        this.pending = { token, target, project };
        return token;
    }

    valid(token: symbol | undefined, target: string | null, project: EditorProjectV2 | null): boolean {
        return (
            !!token &&
            this.pending?.token === token &&
            this.pending.target === target &&
            this.pending.project === project
        );
    }

    consume(token: symbol | undefined, target: string | null, project: EditorProjectV2 | null): boolean {
        const valid = this.valid(token, target, project);
        this.clear();
        return valid;
    }

    clear(): void {
        this.pending = null;
    }

    hasPending(project: EditorProjectV2): boolean {
        return this.pending?.project === project;
    }
}
