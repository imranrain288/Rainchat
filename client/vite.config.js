import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: process.env.VERCEL ? '/' : '',
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'https://rainchat-1.onrender.com',
            '/socket.io': {
                target: 'https://rainchat-1.onrender.com',
                ws: true,
            },
        },
    },
})
