const serverconfig = require('./serverconfig')
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')

export function handle_healthcheck_closure(genomes) {
	// only loaded once when this route handler is created
	const revfile = path.join(process.cwd(), './public/rev.txt')
	let rev = ''
	if (fs.existsSync(revfile)) {
		rev = fs.readFileSync(revfile, { encoding: 'utf8' })
	}

	return async (req, res) => {
		try {
			res.send(await getStat(genomes, rev))
		} catch (e) {
			res.send({ error: e.message || e })
		}
	}
}

async function getStat(genomes, rev) {
	const health = { status: 'ok', rev } // object to be returned to client

	const keys = serverconfig.features.healthcheck_keys || []

	if (keys.includes('w')) {
		health.w = child_process
			.execSync('w | head -n1')
			.toString()
			.trim()
			.split(' ')
			.slice(-3)
			.map(d => (d.endsWith(',') ? +d.slice(0, -1) : +d))
	}

	if (keys.includes('rs')) {
		health.rs =
			child_process
				.execSync('ps aux | grep rsync -w')
				.toString()
				.trim()
				.split('\n').length - 1
	}

	if (serverconfig.commitHash) health.version = serverconfig.commitHash

	// report status of every genome
	for (const gn in genomes) {
		health[gn] = {} // object to store status of this genome

		const genome = genomes[gn] //; console.log(genome.genedb)

		if (genome.genedb) {
			// genedb status
			health[gn].genedb = {
				buildDate: genome.genedb.get_buildDate ? genome.genedb.get_buildDate.get().date : 'unknown',
				tables: genome.genedb.tableSize
			}
		}

		if (genome.termdbs) {
			// genome-level termdb status e.g. msigdb
			health[gn].termdbs = {}
			for (const key in genome.termdbs) {
				const db = genome.termdbs[key]
				health[gn].termdbs[key] = {
					buildDate: db.cohort.termdb.q.get_buildDate ? db.cohort.termdb.q.get_buildDate.get().date : 'unknown'
				}
			}
		}
	}

	return health
}
