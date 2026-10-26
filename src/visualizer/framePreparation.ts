/** A superseded input snapshot ends one frame, without destroying its isolated runtime. */
export class FrameSupersededError extends Error {
    constructor() {
        super('算法帧所属输入已失效。');
        this.name = 'FrameSupersededError';
    }
}
