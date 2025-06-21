import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
    },
    resolve: {
        alias: {
            '@skanii/communicator': './src/index.ts',
            '@skanii/communicator/*': './src/*',
        },
    },
});
