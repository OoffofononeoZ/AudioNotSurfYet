import { scheduler } from 'node:timers/promises';

// Node runner adapter for the browser scheduler used by production analysis.
Object.defineProperty(globalThis, 'scheduler', { configurable: true, value: scheduler });
