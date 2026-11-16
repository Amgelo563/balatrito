import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/sparring.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  keepNames: true,
  treeshake: false,
  clean: true,
});
