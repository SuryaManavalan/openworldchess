import { defineConfig } from 'vitest/config';
// Files run one at a time: the end-to-end test drives a real server with 50ms
// turns, and CPU-heavy in-process simulations running beside it starve it.
export default defineConfig({ test: { include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'], fileParallelism: false, testTimeout: 30_000 } });
