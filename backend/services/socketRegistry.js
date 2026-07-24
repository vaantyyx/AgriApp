// Shared accessor for the Socket.IO server instance and its per-user room
// naming convention. server.js creates `io` itself but is also the module
// that imports every route file (server.js -> routes/admin.js) — a route
// module importing `io` back from server.js would be a circular import.
// Route handlers only ever run after the whole module graph has finished
// loading, so a plain mutable module-level reference, set once at startup
// and read lazily inside request handlers, sidesteps that entirely.
let ioInstance = null;

export function setIo(io) {
  ioInstance = io;
}

export function getIo() {
  return ioInstance;
}

/** Per-user Socket.IO room, used for targeted delivery and online-presence checks. */
export const userRoom = (userId) => `user:${userId}`;
