import type { RouteApi, RoutePayload } from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { hasMdsDataset } from '#src/mds.shared.js'
import { sql } from '#src/sql.ts'

/*
The route of the gene mutation counts of a legacy mds dataset.
*/

const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module is evaluated;
	// the route is only set up when a loaded genome has a legacy mds dataset
	get init() {
		return hasMdsDataset(genomes) ? init : null
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'mdsgenecount',
	methods: {
		post: payload
	}
}

function init({ genomes }) {
	return async function handle_mdsgenecount(req, res) {
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			if (!genome.datasets) throw 'no datasets from genome'
			const ds = genome.datasets[req.query.dslabel]
			if (!ds) throw 'invalid dataset'
			if (!ds.gene2mutcount) throw 'not supported on this dataset'
			if (!req.query.samples) throw '.samples missing'
			// column names cannot be bound as sql parameters, so only allow actual genecount columns
			const columns = new Set(
				ds.gene2mutcount.db
					.prepare('SELECT name FROM pragma_table_info(?)')
					.all('genecount')
					.map(r => r.name)
			)
			const mutTypes = req.query.selectedMutTypes || ['total']
			if (!Array.isArray(mutTypes) || !mutTypes.length) throw 'invalid selectedMutTypes'
			for (const t of mutTypes) {
				if (t == 'gene' || t == 'sample' || !columns.has(t)) throw `invalid mutation type='${t}'`
			}
			const n_gene = req.query.nGenes ? Number(req.query.nGenes) : 15
			if (!Number.isInteger(n_gene) || n_gene < 1) throw 'invalid nGenes'
			const samples = Array.isArray(req.query.samples) ? req.query.samples : String(req.query.samples).split(',')
			const query = sql`WITH
		filtered AS (
			SELECT gene, ${sql.join(
				mutTypes.map(t => sql.id(t)),
				sql`+`
			)} AS total FROM genecount
			WHERE sample IN (${sql.list(samples.map(String))})
		)
		SELECT gene, SUM(total) AS count
		FROM filtered
		GROUP BY gene
		ORDER BY count DESC
		LIMIT ${n_gene}`
			const genes = ds.gene2mutcount.db.prepare(query).all()
			const validgenes: any[] = []
			for (const gene of genes) {
				const re = genome.genedb.getCoordByGene.get(gene.gene)
				if (!re) continue
				re.gene = gene.gene
				re.count = gene.count
				delete re.name
				validgenes.push(re)
			}
			res.send({ genes: validgenes })
		} catch (e: any) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}
