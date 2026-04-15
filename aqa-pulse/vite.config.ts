import * as path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    root: path.resolve(__dirname, 'src/frontend'),
    base: '/ui-assets/',
    plugins: [react()],
    build: {
        outDir: path.resolve(__dirname, 'dist/web'),
        emptyOutDir: true,
    },
    server: {
        port: 4173,
        host: '127.0.0.1',
    },
})