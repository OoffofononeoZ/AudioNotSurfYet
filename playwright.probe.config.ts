import { defineConfig } from '@playwright/test';
import config from './playwright.config';
// Explicit diagnostics only. Failing variants retain their raw errors and never
// become expected passes or part of the canonical P1 acceptance suite.
export default defineConfig({...config,testMatch:'**/p1-runtime.probe.ts'});
