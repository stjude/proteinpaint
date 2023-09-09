const serverconfig = require('./serverconfig')
const { basepath, app, genomes, phewas, startServer, pp_init } = require('./app')
const augen = require('@sjcrh/augen')
const fs = require('fs')
const path = require('path')

{
	// start moving migrated route handler code here
	const files = fs.readdirSync(path.join(serverconfig.binpath, '/routes')).filter(f => f.endsWith('.ts'))
	const routes = files.map(file => Object.assign(require(`../routes/${file}`), { file }))
	const opts = { app, genomes }
	if (serverconfig.debugmode) {
		opts.apiJson = path.join(__dirname, '../public/docs/server-api.json')
		opts.types = {
			importDir: '../..',
			outputFile: path.join(__dirname, './shared/types/routes/checkers/raw/index.ts')
		}
	}
	augen.setRoutes(app, routes, basepath, opts)
}

pp_init()
	.then(async () => {
		// no error from server initiation
		console.log(`\n${new Date()} ${serverconfig.commitHash || ''}`)
		// !!! DO NOT CHANGE THE FOLLOWING MESSAGE !!!
		// a serverconfig.preListenScript may rely on detecting this exact pre-listen() message
		console.log(`\nValidation succeeded.\n`)

		// exit early if only doing a validation of configuration + data + startup code
		if (process.argv[2] == 'validate') {
			console.log(`You may now run the server.`)
			return
		}

		if (process.argv[2] == 'phewas-precompute') {
			// argv[3] is genome, argv[4] is dslabel
			const gn = process.argv[3],
				dslabel = process.argv[4]
			const genome = genomes[gn]
			if (!genome) throw 'invalid genome name: ' + gn
			const ds = genome.datasets[dslabel]
			if (!ds) throw 'invalid dataset: ' + dslabel
			phewas.do_precompute(ds)
			return
		}

		await startServer()
	})
	.catch(err => {
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
		process.exit(exitCode)
	})
