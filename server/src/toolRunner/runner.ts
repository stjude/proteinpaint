import net from 'net'
import fs from 'fs'
import { randomBytes } from 'crypto'
import type { Readable } from 'stream'
import { getCommand } from './requests.ts'
import { spawnCommand } from './spawnCommand.ts'
import { FrameType, FrameReader, writeFrames, writeJson, parseJson, killSignals } from './protocol.ts'

/*
The tool runner, which starts the processes that the server requests, so that the server process can run without
the permission to start a child process. See toolRunner.ts for the process that runs it, and client.ts for the
server side.

Each request is checked and turned into a command by getCommand(), the same as in a server that starts its
processes itself, so the runner never runs a command or argv that is sent to it. A request that fails a check is
answered with a failed frame, and nothing is started.

A process connection carries one request and the stdin, output, and exit of its process, see protocol.ts. When the
connection closes before the process exits, such as when the server stops waiting for it, the process is killed.

A process may also be killed from a new connection with a signal frame, which names the process by the token that
the started frame gave it, since a process connection is not read while the process does not read its stdin.

The control connection is a connection that sends a hello frame, which the server opens when it starts and keeps
open, so that it can tell when the runner exits. A hello frame replaces the earlier control connection, which is
closed, such as when a watch mode restarts the server. The runner itself exits when the process that started it
exits, see toolRunner.ts.
*/

export type RunnerOptions = { socketPath: string }

type RunnerState = { control?: net.Socket; processes: Map<string, ReturnType<typeof spawnCommand>> }

/** resolves with the listening server, whose socket file only this user may connect to */
export function listenToolRunner({ socketPath }: RunnerOptions) {
	const state: RunnerState = { processes: new Map() }
	const server = net.createServer(socket => handleConnection(socket, state))
	return new Promise<net.Server>((resolve, reject) => {
		server.once('error', reject)
		removeStaleSocket(socketPath)
		server.listen(socketPath, () => {
			server.off('error', reject)
			// also in a dir that only this user may list, see container/envHelpers.mjs
			fs.chmodSync(socketPath, 0o600)
			resolve(server)
		})
	})
}

/** a socket file that is left from an earlier runner process, which would make listen() fail */
function removeStaleSocket(socketPath: string) {
	const stat = fs.lstatSync(socketPath, { throwIfNoEntry: false })
	if (!stat) return
	if (!stat.isSocket()) throw `tool runner socket path exists and is not a socket`
	fs.rmSync(socketPath)
}

function handleConnection(socket: net.Socket, state: RunnerState) {
	let mode: 'pending' | 'process' | 'control' = 'pending'
	let child: ReturnType<typeof spawnCommand> | undefined
	let exited = false

	const reader = new FrameReader((type, payload) => {
		if (mode == 'pending') {
			if (type == FrameType.hello) return startControl()
			if (type == FrameType.request) return startRequest(payload)
			if (type == FrameType.signal) return signalByToken(payload)
			throw 'unexpected first frame'
		}
		if (mode == 'control') throw 'unexpected frame on the control connection'
		// after a rejected request, which has no process, or after the process exited, the connection is already ending
		if (!child || exited) return
		if (type == FrameType.stdin) {
			// the socket is paused until the process reads its stdin, so that the stdin data is not buffered here
			if (!child.stdin.write(payload)) {
				socket.pause()
				child.stdin.once('drain', () => socket.resume())
			}
		} else if (type == FrameType.stdinEnd) child.stdin.end()
		else if (type == FrameType.kill) {
			const signal = parseJson(payload)
			if (typeof signal != 'string' || !killSignals.includes(signal)) throw 'invalid kill signal'
			child.kill(signal as NodeJS.Signals)
		} else throw 'unexpected frame'
	})

	socket.on('data', (chunk: Buffer) => {
		try {
			reader.push(chunk)
		} catch (e: any) {
			console.error(`tool runner: closed a connection: ${e?.message || e}`)
			socket.destroy()
		}
	})
	// such as EPIPE when the server closes the connection, which is handled on close
	socket.on('error', () => {})
	socket.on('close', () => {
		if (mode == 'control') {
			if (state.control === socket) delete state.control
		} else if (child && !exited) child.kill()
	})

	function signalByToken(payload: Buffer) {
		mode = 'process'
		const { token, signal } = (parseJson(payload) || {}) as { token?: unknown; signal?: unknown }
		if (typeof signal != 'string' || !killSignals.includes(signal)) throw 'invalid kill signal'
		if (typeof token == 'string') state.processes.get(token)?.kill(signal as NodeJS.Signals)
		socket.end()
	}

	function startControl() {
		// such as of a server that a watch mode restarted, which may be closed after the new one connects
		state.control?.destroy()
		mode = 'control'
		state.control = socket
		writeFrames(socket, FrameType.ready)
	}

	function startRequest(payload: Buffer) {
		mode = 'process'
		let cmd
		try {
			cmd = getCommand(parseJson(payload))
		} catch (e: any) {
			const message = String(e?.message || e)
			console.error(`tool runner: rejected a request: ${message}`)
			writeJson(socket, FrameType.failed, { message })
			socket.end()
			return
		}
		const ps = spawnCommand(cmd)
		child = ps
		const token = randomBytes(16).toString('hex')
		state.processes.set(token, ps)
		ps.on('spawn', () => writeJson(socket, FrameType.started, { token }))
		forward(ps.stdout, FrameType.stdout)
		forward(ps.stderr, FrameType.stderr)
		ps.stdin.on('error', (e: NodeJS.ErrnoException) => {
			writeJson(socket, FrameType.stdinError, { message: e.message, code: e.code })
		})
		ps.on('error', (e: NodeJS.ErrnoException) => {
			writeJson(socket, FrameType.failed, { message: e.message, code: e.code, errno: e.errno })
		})
		// after the stdout and stderr of the process are closed, so that all its output is sent before the exit
		ps.on('close', (code, signal) => {
			exited = true
			state.processes.delete(token)
			writeJson(socket, FrameType.exit, { code, signal })
			socket.end()
			// a socket that was paused for the stdin of the process reads and ignores the rest, so that it can close
			socket.resume()
		})
	}

	/** sends the output of a stream, which is paused while the socket buffer is full */
	function forward(stream: Readable, type: number) {
		stream.on('data', (d: Buffer) => {
			if (!writeFrames(socket, type, d)) {
				stream.pause()
				socket.once('drain', () => stream.resume())
			}
		})
	}
}
