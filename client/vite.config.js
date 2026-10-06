import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: process.env.VERCEL ? '/' : '',
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'http://localhost:5000',
            '/socket.io': {
                target: 'http://localhost:5000',
                ws: true,
            },
        },
    },
})
