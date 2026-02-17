import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: '상권분석 리포트',
                short_name: '상권리포트',
                description: '데이터 기반 소상공인 상권분석 컨설팅',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'icon.svg',
                        type: 'image/svg+xml',
                        sizes: 'any',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            }
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'firebase/app', 'firebase/firestore', 'firebase/storage']
                }
            }
        }
    }
})
