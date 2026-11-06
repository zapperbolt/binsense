import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests run in Node (no browser). The React plugin lets Vitest import .jsx files.
export default defineConfig({ plugins: [react()], test: { environment: 'node' } });
