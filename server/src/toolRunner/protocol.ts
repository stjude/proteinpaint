import type { Socket } from 'net'

/*
The messages between the server and the tool runner, over one Unix socket connection per process.

Each message is a frame: a 1-byte type, a 4-byte big-endian payload length, and the payload. A JSON payload is a
UTF-8 string. A data payload, such as of stdin or stdout, is split into frames of at most maxPayload bytes.

server -> runner, on a process connection:
	request: the JSON request, see requests.ts; the first and only request frame
	stdin, stdinEnd: the stdin data of the process, and its end
	kill: the JSON signal name, from the kill() of the process
server -> runner, on the control connection:
	hello: the first frame, which marks the connection that the runner and the server each exit without

runner -> server:
	started: the process is started
	stdout, stderr: the output data of the process
	stdinError: JSON {message, code} of an error when writing the stdin of the process, such as EPIPE
	exit: JSON {code, signal} when the process has exited and its output has been sent
	failed: JSON {message, code, errno} when the request is rejected or the process cannot be started
	ready: the reply to hello
*/

export const FrameType = Object.freeze({
	request: 1,
	stdin: 2,
	stdinEnd: 3,
	kill: 4,
	hello: 5,
	started: 10,
	stdout: 11,
	stderr: 12,
	stdinError: 13,
	exit: 14,
	failed: 15,
	ready: 16
})

/** the upper limit of the payload of a frame, so that a frame is never buffered without a bound */
export const maxPayload = 1 << 20

/** the signals that kill() may send */
export const killSignals: readonly string[] = Object.freeze(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP'])

const headerLength = 5

/** writes the frames of a payload, and returns false when the socket buffer is full, like socket.write() */
export function writeFrames(socket: Socket, type: number, payload: Buffer | string = Buffer.alloc(0)): boolean {
	const data = typeof payload == 'string' ? Buffer.from(payload, 'utf8') : payload
	let ok = true
	let offset = 0
	do {
		const part = data.subarray(offset, offset + maxPayload)
		const header = Buffer.alloc(headerLength)
		header.writeUInt8(type, 0)
		header.writeUInt32BE(part.length, 1)
		ok = socket.write(Buffer.concat([header, part])) && ok
		offset += maxPayload
	} while (offset < data.length)
	return ok
}

export function writeJson(socket: Socket, type: number, value: unknown): boolean {
	return writeFrames(socket, type, JSON.stringify(value))
}

/** collects the data chunks of a socket into frames, and calls onFrame() for each one */
export class FrameReader {
	#chunks: Buffer[] = []
	#length = 0
	#onFrame: (type: number, payload: Buffer) => void

	constructor(onFrame: (type: number, payload: Buffer) => void) {
		this.#onFrame = onFrame
	}

	/** throws for a frame that is larger than maxPayload */
	push(chunk: Buffer) {
		this.#chunks.push(chunk)
		this.#length += chunk.length
		while (this.#length >= headerLength) {
			const head = this.#chunks[0].length >= headerLength ? this.#chunks[0] : Buffer.concat(this.#chunks)
			const size = head.readUInt32BE(1)
			if (size > maxPayload) throw 'frame payload is too large'
			// the chunks are joined only when the whole frame is received
			if (this.#length < headerLength + size) return
			const buf = this.#chunks.length == 1 ? this.#chunks[0] : Buffer.concat(this.#chunks)
			const type = buf.readUInt8(0)
			const payload = buf.subarray(headerLength, headerLength + size)
			const rest = buf.subarray(headerLength + size)
			this.#chunks = rest.length ? [rest] : []
			this.#length = rest.length
			this.#onFrame(type, payload)
		}
	}
}

export function parseJson(payload: Buffer): unknown {
	return JSON.parse(payload.toString('utf8'))
}
