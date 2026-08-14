import { io } from 'socket.io-client';
import { getAccessToken, API_ORIGIN } from './axiosClient';

let socket = null;

export const connectSocket = () => {
  if (socket?.connected) return socket;

  socket = io(API_ORIGIN, {
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
