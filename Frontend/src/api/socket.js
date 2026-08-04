import { io } from 'socket.io-client';
import { getAccessToken } from './axiosClient';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket = null;

export const connectSocket = () => {
  if (socket?.connected) return socket;

  socket = io(URL, {
    withCredentials: true,
    autoConnect: true,
    auth: { token: getAccessToken() },
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
