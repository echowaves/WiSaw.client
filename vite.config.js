import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

import { asyncCssPlugin } from './src/build/vite-plugin-async-css'

export default defineConfig({
    plugins: [
        react(),
        svgr(),
        // Registered last so the emitted stylesheet links are already in the HTML it receives.
        asyncCssPlugin()
    ],
    esbuild: {
        loader: 'jsx',
        include: /src\/.*\.js$/,
        exclude: []
    },
    optimizeDeps: {
        esbuildOptions: {
            loader: {
                '.js': 'jsx'
            }
        }
    },
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'build',
        sourcemap: false
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/setupTests.js',
        globals: true
    }
})
