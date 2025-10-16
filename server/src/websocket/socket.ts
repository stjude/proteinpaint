import { Server } from 'socket.io'

let io: Server | null = null

//`job:${jobId}` == room name
export function mountSocketIO(server: any) {
	io = new Server(server, {
		/* { cors: { origin: '*' }, path: '/ws' }*/
	})

	io.on('connection', socket => {
		socket.on('subscribe-job', (jobId: string) => {
			console.log(`socket ${socket.id} subscribing to job ${jobId}`)
			socket.join(`job:${jobId}`)
		})
		socket.on('unsubscribe-job', (jobId: string) => {
			socket.leave(`job:${jobId}`)
		})
		// socket.on("disconnect", () => { /* no-op */ })
	})
	return io
}

export function getIO() {
	if (!io) throw new Error('Socket.IO not initialized')
	return io
}
