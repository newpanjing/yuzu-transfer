import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const REACT_VENDOR_CHUNK = 'react-vendor';
const ICONS_CHUNK = 'icons';
const QRCODE_CHUNK = 'qrcode';
const VENDOR_CHUNK = 'vendor';
const NODE_MODULES_SEGMENT = '/node_modules/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET?.trim() || 'http://localhost:8080';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: proxyTarget, ws: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes(NODE_MODULES_SEGMENT)) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/')) return REACT_VENDOR_CHUNK;
            if (id.includes('/lucide-react/')) return ICONS_CHUNK;
            if (id.includes('/qrcode.react/')) return QRCODE_CHUNK;
            return VENDOR_CHUNK;
          },
        },
      },
    },
  };
});
