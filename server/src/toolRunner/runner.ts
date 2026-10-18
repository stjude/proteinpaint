import net from 'net'
import fs from 'fs'
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

The control connection is the first connection that sends a hello frame. When it closes, the server is assumed to
have exited, and onControlClose() is called.
*/

export type RunnerOptions = {
	socketPath: string
	/** by default, exits the runner process */
	onControlClose?: () => void
}

type RunnerState = { control?: net.Socket; onControlClose: () => void }

/** resolves with the listening server, whose socket file only this user may connect to */
export function listenToolRunner({ socketPath, onControlClose = () => process.exit(0) }: RunnerOptions) {
	const state: RunnerState = { onControlClose }
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
			throw 'unexpected first frame'
		}
		if (mode == 'control') throw 'unexpected frame on the control connection'
		// after a rejected request, which has no process, the connection is already ending
		if (!child) return
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
		if (mode == 'control') state.onControlClose()
		else if (child && !exited) child.kill()
	})

	function startControl() {
		if (state.control) throw 'a control connection is already open'
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
		ps.on('spawn', () => writeFrames(socket, FrameType.started))
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
			writeJson(socket, FrameType.exit, { code, signal })
			socket.end()
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
