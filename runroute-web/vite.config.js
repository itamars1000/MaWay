import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Geolocation needs a secure context. On localhost plain HTTP is fine, but to
// test real GPS on a phone over the LAN you need HTTPS — opt in with HTTPS=1.
// e.g.  HTTPS=1 npm run dev   (PowerShell:  $env:HTTPS=1; npm run dev)
const useHttps = !!process.env.HTTPS;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
  server: {
    host: true, // expose on the LAN so you can open it on a phone
    // Honor an assigned port (e.g. from tooling) if provided, else default 5173.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
});
