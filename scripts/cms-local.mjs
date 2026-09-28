// Never bind the unauthenticated file-writing proxy to the LAN.
process.env.BIND_HOST = '127.0.0.1';
await import('decap-server');
