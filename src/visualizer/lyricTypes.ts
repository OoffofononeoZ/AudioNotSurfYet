export interface LyricInputContract {
    id: string;
}
export interface LyricInputDefinition extends LyricInputContract {
    label: string;
}
export interface LyricAsset {
    id: string;
    name: string;
    data: string;
}
export type LyricBinding =
    | { kind: 'unbound' }
    | {
          kind: 'lyrics';
          assetId: string;
          leadSeconds: number;
          tailSeconds: number;
          offsetSeconds: number;
      };
export type LyricBindings = Record<string, LyricBinding>;
export interface LyricCue {
    index: number;
    time: number;
    end: number;
    text: string;
    tokens: string[];
}
export interface LyricTokenFrame {
    index: number;
    text: string;
    time: number;
    page: number;
    uv: [number, number, number, number];
    width: number;
    height: number;
}
export interface LyricCueFrame {
    index: number;
    time: number;
    end: number;
    tokens: LyricTokenFrame[];
}
export interface LyricFrameInfo {
    available: boolean;
    revision: string;
    leadSeconds: number;
    tailSeconds: number;
    cues: LyricCueFrame[];
}
export type LyricFrame = Record<string, LyricFrameInfo>;
