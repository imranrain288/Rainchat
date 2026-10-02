import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: process.env.VERCEL ? '/' : '/Rainchat/',
    plugins: [react()],
    server: {
        proxy: {
            '/api': 'https://rainchat-gilt.vercel.app/api',
            '/socket.io': {
                target: 'https://rainchat-gilt.vercel.app/socket.io/',
                ws: true,
                rewrite: (path) => path.replace(/^\/socket\.io/, '/api/socket-io/socket.io'),
            },
        },
    },
})
