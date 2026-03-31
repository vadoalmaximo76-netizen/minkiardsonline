import { io } from 'socket.io-client';

export const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 30000,
  forceNew: false
});

let reconnectAttempts = 0;

socket.on('connect', () => {
  console.log('Connected to server');
  reconnectAttempts = 0;
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: true } }));
  
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    const lastGameId = localStorage.getItem('mink_lastGameId') || undefined;
    console.log('[socket] Sending set-user-data on connect, lastGameId:', lastGameId);
    socket.emit('set-user-data', { authToken, lastGameId });
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server:', reason);
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: false, reason } }));
});

socket.on('reconnect_attempt', (attempt) => {
  reconnectAttempts = attempt;
  console.log(`Reconnection attempt ${attempt}`);
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: false, reconnecting: true, attempt } }));
});

socket.on('reconnect', (attempt) => {
  console.log(`Reconnected after ${attempt} attempts`);
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: true, reconnected: true } }));
  // NOTE: do NOT emit set-user-data or rejoin-game here.
  // The 'connect' event always fires before 'reconnect' and already sends set-user-data.
  // Server's set-user-data handler automatically re-joins the player to their active game.
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after all attempts');
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: false, failed: true } }));
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: false, error: error.message } }));
});

// Acknowledge server heartbeat to keep the WebSocket connection alive
// through the production proxy (which drops idle connections after ~5 min).
socket.on('heartbeat', () => {
  socket.emit('heartbeat-ack');
});
