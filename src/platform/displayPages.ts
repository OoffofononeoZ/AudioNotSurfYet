/** Display styles stay in the current platform's local storage. */
export interface DisplayPageAccess {
    readonly canCopyAddress: boolean;
    address(path: string): string | null;
}

export const browserDisplayPages: DisplayPageAccess = {
    canCopyAddress: true,
    address: path => new URL(path, location.origin).href,
};

export const applicationDisplayPages: DisplayPageAccess = {
    canCopyAddress: false,
    address: () => null,
};
