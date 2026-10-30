/** Replace only OS selection results; all application IPC and file IO stay real. */
export async function installDialogFixture(app) {
    await app.evaluate(({ dialog }) => {
        globalThis.__desktopFileDialogs = { open: [], save: [], confirm: [], calls: [] };
        for (const [method, kind] of [
            ['showOpenDialog', 'open'],
            ['showSaveDialog', 'save'],
        ]) {
            dialog[method] = async (_owner, options) => {
                const state = globalThis.__desktopFileDialogs;
                state.calls.push({ kind, title: options.title });
                const next = state[kind].shift();
                if (!next) throw Error(`Unexpected ${kind} dialog in desktop integration`);
                return next;
            };
        }
        dialog.showMessageBox = async (_owner, options) => {
            const state = globalThis.__desktopFileDialogs;
            state.calls.push({ kind: 'confirmation', title: options.title });
            if (options.title === '退出 AudioNotSurfYet') return { response: 1, checkboxChecked: false };
            const next = state.confirm.shift();
            if (!next || next.title !== options.title) throw Error(`Unexpected confirmation: ${options.title}`);
            return { response: next.response, checkboxChecked: false };
        };
    });
}

export const queueOpen = (app, filePaths = []) =>
    app.evaluate((_electron, files) => {
        globalThis.__desktopFileDialogs.open.push({ canceled: files.length === 0, filePaths: files });
    }, filePaths);

export const queueSave = (app, filePath) =>
    app.evaluate((_electron, file) => {
        globalThis.__desktopFileDialogs.save.push(file ? { canceled: false, filePath: file } : { canceled: true });
    }, filePath);

export const queueConfirmation = (app, title, response) =>
    app.evaluate(
        (_electron, answer) => {
            globalThis.__desktopFileDialogs.confirm.push(answer);
        },
        { title, response },
    );
