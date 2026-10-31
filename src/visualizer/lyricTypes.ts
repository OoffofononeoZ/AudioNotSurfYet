export interface LyricInputContract {
    id: string;
    granularity?: 'grapheme';
    tailSecondsParameter?: string;
}
export interface LyricInputDefinition extends LyricInputContract {
    label: string;
    defaultLeadSeconds?: number;
}
export interface LyricAsset {
    id: string;
    name: string;
    data: string;
}
export interface LyricFont {
    family: string;
    fullName: string;
    postscriptName: string;
}
export type LyricBinding =
    | { kind: 'unbound' }
    | {
          kind: 'lyrics';
          assetId: string;
          leadSeconds: number;
          tailSeconds: number;
          offsetSeconds: number;
          font?: LyricFont;
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
    offsetX?: number;
    advance?: number;
}
export interface LyricCueFrame {
    index: number;
    time: number;
    end: number;
    lineWidth?: number;
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
