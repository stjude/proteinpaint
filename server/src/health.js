const serverconfig = require('./serverconfig')

export function handle_healthcheck_closure(genomes) {
	return async (req, res) => {
		try {
			res.send(await getStat(genomes))
		} catch (e) {
			res.send({ error: e.message || e })
		}
	}
}

async function getStat(genomes) {
	const health = { status: 'ok' } // object to be returned to client

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

		const genome = genomes[gn]

		if (genome.genedb) {
			// genedb status
			health[gn].genedb = {
				buildDate: genome.genedb.get_buildDate ? genome.genedb.get_buildDate.get().date : 'unknown',
				has_alias: genome.genedb.getNameByAlias ? true : false,
				has_gene2coord: genome.genedb.getCoordByGene ? true : false,
				has_gene2canonicalisoform: genome.genedb.get_gene2canonicalisoform ? true : false,
				has_refseq2ensembl: genome.genedb.hasTable_refseq2ensembl ? true : false,
				has_ideogram: genome.genedb.hasIdeogram
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
