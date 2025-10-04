// Minimal module declarations to avoid noisy "Could not find a declaration file" TS errors
declare module 'express';
declare module 'socket.io';
declare module 'socket.io-client';
declare module 'mysql2/promise';

// If other modules cause missing-declarations errors, add them here temporarily.
declare module '*.png'
declare module '*.jpg'
declare module '*.svg'
declare module '*.jpeg'