import { getIO } from './io.ts'

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

	const push = (payload: any) => {
		remember(jobId, payload)
		console.log(21, `emitting to ${room}:`, payload)
		io.to(room).emit('task-progress', { jobId, ...payload })
	}

	// initial
	push({ percent: 0, status: 'queued' })

	return {
		jobId,
		emit: p => push({ status: 'running', ...p }),
		done: data => push({ percent: 100, status: 'completed', data }),
		fail: err => push({ status: 'error', message: (err as Error)?.message || String(err) })
	}
}

function getId() {
	return Math.random().toString(36).slice(2)
}

//For caching last progress state
//Allows new subscribers to get the last known state immediately
const lastProgress = new Map<string, any>()
export function remember(jobId: string, payload: any) {
	lastProgress.set(jobId, { jobId, ...payload })
}

export function getLast(jobId: string) {
	return lastProgress.get(jobId)
}
