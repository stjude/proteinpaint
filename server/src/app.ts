// from the proteinpaint/server dir, run via
// $ npx tsx watch src/app.ts
//
import express from 'express'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import { spawnSync } from 'child_process'
import * as augen from '@sjcrh/augen'
import serverconfig from './serverconfig.js'
import { genomes, initGenomesDs } from './initGenomesDs.js'
import { setAppMiddlewares } from './app.middlewares.js'
import * as oldApp from './app.unorg.js'
import { authApi } from './auth.js'
import * as phewas from './termdb.phewas.js'
import { sendMessageToSlack } from './postOnSlack.js'
import { routeFiles } from './app.routes.js'

const basepath = serverconfig.basepath || ''
Object.freeze(process.argv)

export async function launch() {
	try {
		const trackedDatasets = await initGenomesDs(serverconfig)
		processTrackedDs(trackedDatasets)

		// no error from server initiation
		console.log(`\n${new Date()} ${serverconfig.commitHash || ''}`)

		console.log('setting app middlewares ...')
		const app = express()
		app.disable('x-powered-by')
		setAppMiddlewares(app)

		console.log('setting server routes ...')
		await setOptionalRoutes(app)
		console.log('may set auth routes ...')
		/*
		 !!! the order of middlewares is critical, must be set before data routes !!!
		  - so that a request will be inspected by auth before allowing 
		    to proceed to any *protected* route handler
		*/
		authApi.maySetAuthRoutes(app, basepath, serverconfig)

		const routes = await Promise.all(routeFiles)
		const __dirname = import.meta.dirname
		augen.setRoutes(app, routes, {
			app,
			genomes,
			basepath: serverconfig.basepath || '',
			apiJson: path.join(__dirname, '../../public/docs/server-api.json')
			/*
			 	As an alternative to manually adding/removing imports in shared/types/src/routes, 
			 	you may temporarily uncomment below to generate runtime route checker code, 
			  should only uncomment when a file has been added or deleted in 
			  shared/types/src/routes and not when modified.
			*/
			// , types: serverconfig.debugmode && {
			// 	importDir: '../routes',
			// 	outputFile: path.join(__dirname, '../../shared/types/src/checkers/routes.ts')
			// }
		})

		oldApp.setRoutes(app, genomes, serverconfig)

		// !!! DO NOT CHANGE THE FOLLOWING MESSAGE !!!
		// a serverconfig.preListenScript may rely on detecting this exact pre-listen() message
		console.log(`\nValidation succeeded.\n`)

		// may exit early depending on command-line options
		const exitMessage = handle_argv(process.argv)
		if (exitMessage) {
			console.log(exitMessage)
			return
		}

		await startServer(app)
		return app
	} catch (err: any) {
		let exitCode = 1
		if (!fs.existsSync(serverconfig.tpmasterdir)) {
			const m = serverconfig.maintenance || {}
			// may override with a non-empty maintenance message
			if ('start' in m && 'stop' in m && 'tpErrorCode' in m) {
				// use unix timestamps to simplify comparison
				const start = +new Date(m.start)
				const stop = +new Date(m.stop)
				const currTime = +new Date()
				if (start <= currTime && currTime <= stop) {
					exitCode = m.tpErrorCode
				}
			}
		}

		if (err.stack) console.log(err.stack)
		if (exitCode) console.error('\n!!!\n' + err + '\n\n')
		else console.log('\n!!!\n' + err + '\n\n')
		/*
      when the app server is monitored by another process via the command line,
      process.exit(1) is required to stop execution flow with `set -e`
      and thereby avoid unnecessary endless restarts of an invalid server
      init with bad config, data, and/or code
    */
		const msg = err.stack ? err.stack : err
		if (serverconfig.slackWebhookUrl) {
			const url = serverconfig.URL
			const message = `Startup error on: ${url} \n` + `${msg}`
			await sendMessageToSlack(
				serverconfig.slackWebhookUrl,
				message,
				path.join(serverconfig.cachedir, '/slack/last_message_hash.txt')
			)
				.then(() => {
					process.exit(exitCode)
				})
				.catch(() => {
					process.exit(exitCode)
				})
		} else {
			process.exit(exitCode)
		}
	}
}

function handle_argv(argv) {
	if (!argv?.length) return
	if (argv.includes('validate'))
		// exit early if only doing a validation of configuration + data + startup code
		return `You may now run the server.`

	if (argv.includes('phewas-precompute')) {
		// argv[3] is genome, argv[4] is dslabel
		const gn = argv[3],
			dslabel = argv[4]
		const genome = genomes[gn]
		if (!genome) throw 'invalid genome name: ' + gn
		const ds = genome.datasets[dslabel]
		if (!ds) throw 'invalid dataset: ' + dslabel
		phewas.do_precompute(ds)
		return `computed phewas`
	}
}

async function startServer(app) {
	if (serverconfig.preListenScript) {
		const { cmd, args } = serverconfig.preListenScript
		const ps = spawnSync(cmd, args, { encoding: 'utf-8' })
		if (ps.stderr.trim()) throw ps.stderr.trim()
		console.log(ps.stdout)
	}

	// serverconfig.appEnable is an array of strings that are
	// valid arguments to http://expressjs.com/en/4x/api.html#app.enabled
	// For example, when the server sits behind a trusted reverse proxy,
	// "appEnable": ["trust proxy"]
	if (serverconfig.appEnable) serverconfig.appEnable.forEach(d => app.enable(d))

	const port = serverconfig.port
	// !!! DO NOT CHANGE THE FOLLOWING MESSAGE !!!
	// a serverconfig.preListenScript may rely on detecting this exact post-listen() message
	const message = `STANDBY AT PORT ${port}`
	if (serverconfig.ssl) {
		const options = {
			key: fs.readFileSync(serverconfig.ssl.key),
			cert: fs.readFileSync(serverconfig.ssl.cert)
		}
		const server = await https.createServer(options, app)
		// second optional argument is host, formatted so that req.ip will be ipv4
		server.listen(port, '0.0.0.0', () => {
			console.log(`HTTPS ${message}`)
		})
		return server
	} else {
		const server = await http.createServer(app)
		// second optional argument is host, formatted so that req.ip will be ipv4
		server.listen(port, '0.0.0.0', () => {
			if (process.send) {
				process.send('ready')
			}
			console.log(message)
		})
		return server
	}
}

async function setOptionalRoutes(app) {
	// routeSetters is an array of "filepath/name.js"
	if (!serverconfig.routeSetters) return
	for (const fname of serverconfig.routeSetters) {
		if (fname.endsWith('.js')) {
			const _ = await import(fname)
			_.default(app, basepath)
		}
	}
}

function processTrackedDs(trackedDatasets) {
	const getLabel = ds => `${ds.genomename}/${ds.label}`
	// console.log(trackedDatasets.map(ds => [ds.label, ds.init.status]))
	const done = trackedDatasets.filter(ds => ds.init.status === 'done')
	const nonblocking = trackedDatasets.filter(
		ds => ds.init.status === 'nonblocking' || ds.init.status == 'recoverableError'
	)
	if (!done.length && !nonblocking.length) {
		// if no dataset loaded successfully, and only if there are genome + dataset entries,
		// then assume that there may be something wrong with serverconfig and/or code,
		// not with dataset js/ts files, and crash the server to trigger rollback
		if (trackedDatasets.length) throw `${serverconfig.URL}: there were no datasets that loaded successfully`
	} else {
		if (done.length) {
			console.log(`\n--- these datasets finished loading ---`)
			console.log(done.map(getLabel).join(', '))
		}

		if (nonblocking.length) {
			console.log(`\n--- these datasets are running nonblocking initialization steps ---`)
			console.log(nonblocking.map(getLabel).join(', '))
		}

		const activeRetries = trackedDatasets.filter(ds => ds.init.status === 'recoverableError')
		if (activeRetries.length) {
			console.log(`\n--- active retries after initial attempt at loading dataset ---`)
			console.log(activeRetries.map(getLabel).join(', '))
		}

		const failed = trackedDatasets.filter(
			ds => !done.includes(ds) && !nonblocking.includes(ds) && !activeRetries.includes(ds)
		)
		if (failed.length) {
			const list = failed
				.map(
					ds =>
						getLabel(ds) +
						`: ${ds.init.fatalError || ds.init.recoverableError || ds.init.error || '(see startup logs)'}`
				)
				.join('\n')
			const msg = `\n--- failed dataset init ---\n${list}\n`
			console.log(msg)
			// not a fatal error for the server and will not trigger a deployment rollback notification,
			// so must trigger a notification here
			if (serverconfig.slackWebhookUrl) {
				const hostname =
					serverconfig.hostname || spawnSync('hostname', ['-s'], { encoding: 'utf-8' })?.stdout?.trim() || ''
				sendMessageToSlack(
					serverconfig.slackWebhookUrl,
					`\n${serverconfig.URL} ${hostname}: ${msg}`,
					path.join(serverconfig.cachedir, '/slack/last_message_hash.txt')
				).catch(console.log)
			}
		}
	}
}
