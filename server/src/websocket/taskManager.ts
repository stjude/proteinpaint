import { getIO } from './socket.ts'

export type Progress = {
	jobId: string
	emit: (partial: {
		percent?: number
		status?: 'queued' | 'running' | 'completed' | 'cancelled' | 'error'
		message?: string
		data?: unknown
	}) => void
	done: (data?: unknown) => void
	fail: (err: unknown) => void
}

export function createProgress(jobId = getId()): Progress {
	const io = getIO()
	const room = `job:${jobId}`
	console.log(`created progress for job ${jobId} in room ${room}`)

	const emit = (partial: any) => {
		console.log(21, `emitting to ${room}:`, partial)
		io.to(room).emit('task-progress', { jobId, ...partial })
	}

	// initial
	emit({ percent: 0, status: 'queued', message: 'Queued' })

	return {
		jobId,
		emit: p => emit({ status: 'running', ...p }),
		done: data => emit({ percent: 100, status: 'completed', data }),
		fail: err => emit({ status: 'error', message: (err as Error)?.message || String(err) })
	}
}

function getId() {
	return Math.random().toString(36).slice(2)
}
