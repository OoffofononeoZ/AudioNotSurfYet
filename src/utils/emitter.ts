import mitt from 'mitt';
import type { Emitter } from 'mitt';
import type { mittEvents } from '../types/events';

export const emitter: Emitter<mittEvents> = mitt<mittEvents>();