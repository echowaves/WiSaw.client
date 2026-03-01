import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
    plugins: [
        react(),
        svgr()
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
