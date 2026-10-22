/** Portable media bytes belong to snapshots; decoders and textures belong to the host. */
export interface MediaAsset {
    id: string;
    name: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'video/webm' | 'video/mp4';
    data: string;
}
export interface MediaInputContract {
    id: string;
    kinds: ('image' | 'video')[];
    multiple: boolean;
}
export interface MediaInputDefinition extends MediaInputContract {
    label: string;
}
export type MediaBinding =
    | { kind: 'none' }
    | {
          kind: 'media';
          assetIds: string[];
          fit: 'cover' | 'contain' | 'initial';
          intervalSeconds: number;
          crossfadeSeconds: number;
      };
export type MediaBindings = Record<string, MediaBinding>;
export interface MediaFrameInfo {
    available: boolean;
    width: number;
    height: number;
    nextWidth: number;
    nextHeight: number;
    mix: number;
    fit: 'cover' | 'contain' | 'initial';
}
export type MediaFrame = Record<string, MediaFrameInfo>;
