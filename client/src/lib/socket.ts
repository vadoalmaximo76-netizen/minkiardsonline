import { io } from 'socket.io-client';

export const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 30000,
  forceNew: false
});

let reconnectAttempts = 0;

socket.on('connect', () => {
  console.log('Connected to server');
  reconnectAttempts = 0;
  window.dispatchEvent(new CustomEvent('socket-status', { detail: { connected: true } }));
  
  // Register user for invitations on every connection/reconnection
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    console.log('Auto-registering user for invitations on connect');
    socket.emit('set-user-data', { authToken });
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
  
  // Re-register user for invitations after reconnection
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    console.log('Re-registering user for invitations after reconnect');
    socket.emit('set-user-data', { authToken });
  }
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
