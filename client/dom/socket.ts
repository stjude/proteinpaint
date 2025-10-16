import { io } from 'socket.io-client'
export const socket = io()

socket.on('connect', () => console.log('WS connected'))
socket.on('disconnect', () => console.log('WS disconnected'))
