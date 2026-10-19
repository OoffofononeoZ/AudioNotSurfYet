export const assetsRoot: string;
export const assetsAvailable: boolean;
export function resourceRows(): Array<{ dir: string; info: any; pack: any }>;
export function resourcePack(path: string): any;
export function sourceModule(id: string, path: string): string;
