import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Attach Pusher globally for Laravel Echo's internal resolution
(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

export const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY ?? 'fleet-tracker-key';
export const REVERB_HOST = import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1';
export const REVERB_PORT = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);
export const REVERB_SCHEME = import.meta.env.VITE_REVERB_SCHEME ?? 'http';

export const echo = new Echo({
  broadcaster: 'reverb',
  key: REVERB_KEY,
  wsHost: REVERB_HOST,
  wsPort: REVERB_PORT,
  wssPort: REVERB_PORT,
  forceTLS: REVERB_SCHEME === 'https',
  enabledTransports: ['ws', 'wss'],
  disableStats: true,
});

export default echo;
