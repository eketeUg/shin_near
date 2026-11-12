import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: false,
  allowedDevOrigins: ['http://192.168.0.100', '192.168.0.100:3002', '192.168.0.100:3000', 'e756-197-211-52-64.ngrok-free.app', 'https://e756-197-211-52-64.ngrok-free.app', 'http://localhost', 'http://127.0.0.1'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS,PUT,DELETE' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization, Bypass-Tunnel-Reminder' },
        ],
      },
    ];
  },
};

export default nextConfig;
