/*
	Start a real, fully launched server instance for request-based tests.

	Unlike unit tests that call route handlers or auth methods directly, a request against this server
	goes through the same app middlewares, auth middleware, auth routes, augen routes, and legacy app routes
	as a deployed server, so that the tests can verify that these all work together.

	Each server runs in a child process, with its own generated serverconfig.json in a temporary working
	directory, so that:
	- the test-specific config (for example, dsCredentials and basepath) is isolated from the dev/CI serverconfig
	- the shared authApi, that is assigned once per process by app.ts, is not shared with other tests

	Usage:
	const server = await startTestServer({ dsCredentials: {...}, basepath: '/pp' })
	const res = await fetch(`${server.url}/termdb?...`)
	await server.stop()
*/

import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'

const serverDir = path.join(import.meta.dirname, '..')

export type TestServer = {
	/** the origin + basepath, to be used as the prefix of request URLs */
	url: string
	/** the origin only, without the basepath */
	origin: string
	port: number
	/** the combined stdout and stderr of the server process */
	getLogs: () => string
	stop: () => Promise<void>
}

// the same genome and dataset as the CI serverconfig, see container/ci/serverconfig.json
function getBaseConfig() {
	return {
		debugmode: true,
		defaultgenome: 'hg38-test',
		genomes: [
			{
				name: 'hg38-test',
				species: 'human',
				file: './genome/hg38.test.js',
				datasets: [{ name: 'TermdbTest', jsfile: './dataset/termdb.test.js' }]
			}
		],
		features: {
			// the R packages, samtools, and bcftools that this startup check requires are not needed by
			// request tests; the TermdbTest dataset still requires tabix and h5dump to load
			skip_checkDependenciesAndVersions: true
		},
		binpath: serverDir,
		tpmasterdir: path.join(serverDir, 'test/tp'),
		backend_only: true
	}
}

export async function startTestServer(overrides: any = {}, opts: { timeout?: number } = {}): Promise<TestServer> {
	const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-test-server-'))
	const port = await getFreePort()
	const cachedir = path.join(workdir, 'cache')
	fs.mkdirSync(cachedir)
	const config = Object.assign(getBaseConfig(), { cachedir, port, URL: `http://localhost:${port}` }, overrides)
	fs.writeFileSync(path.join(workdir, 'serverconfig.json'), JSON.stringify(config, null, '  '))

	// reuse the tsx loader flags of the current process, if any, so that the child can import .ts files
	const child = spawn(process.execPath, [...process.execArgv, path.join(serverDir, 'test/testServer.launch.ts')], {
		cwd: workdir,
		env: process.env,
		stdio: ['ignore', 'pipe', 'pipe']
	})

	let logs = ''
	const origin = `http://127.0.0.1:${port}`
	const server: TestServer = {
		url: origin + (config.basepath || ''),
		origin,
		port,
		getLogs: () => logs,
		stop: async () => {
			await stopChild(child)
			fs.rmSync(workdir, { recursive: true, force: true })
		}
	}

	try {
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error(`test server did not start within ${opts.timeout || 60000} ms`)),
				opts.timeout || 60000
			)
			const onData = chunk => {
				logs += chunk
				// this message is emitted by app.ts startServer() once the server is listening
				if (logs.includes(`STANDBY AT PORT ${port}`)) {
					clearTimeout(timeout)
					resolve()
				}
			}
			child.stdout!.on('data', onData)
			child.stderr!.on('data', onData)
			child.on('exit', code => {
				clearTimeout(timeout)
				reject(new Error(`test server exited with code=${code} before listening`))
			})
		})
	} catch (e) {
		await server.stop()
		console.log(logs)
		throw e
	}
	return server
}

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = net.createServer()
		srv.unref()
		srv.on('error', reject)
		srv.listen(0, '127.0.0.1', () => {
			const { port } = srv.address() as net.AddressInfo
			srv.close(() => resolve(port))
		})
	})
}

function stopChild(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
	return new Promise(resolve => {
		const forceKill = setTimeout(() => child.kill('SIGKILL'), 5000)
		child.once('exit', () => {
			clearTimeout(forceKill)
			resolve()
		})
		child.kill('SIGTERM')
	})
}
