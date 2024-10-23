//import fs from 'fs'
import path from 'path'
import run_R from '#src/run_R.js'
import type {
	TermdbClusterRequestGeneExpression,
	TermdbClusterRequest,
	TermdbClusterResponse,
	Clustering,
	ValidResponse,
	SingletermResponse,
	GeneExpressionQuery,
	GeneExpressionQueryNative,
	GeneExpressionQueryGdc
} from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { gdc_validate_query_geneExpression } from '#src/mds3.gdc.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering.js'
import { getResult as getResultGene } from '#src/gene.js'
import { TermTypes } from '#shared/terms.js'

export const api = {
	endpoint: 'termdb/cluster',
	methods: {
		all: {
			init,
			request: {
				typeId: 'TermdbClusterRequest'
			},
			response: {
				typeId: 'TermdbClusterResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as TermdbClusterRequest
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (ds.__gdc && !ds.__gdc.doneCaching)
				throw 'The server has not finished caching the case IDs: try again in about 2 minutes.'
			if (q.dataType == TermTypes.GENE_EXPRESSION || q.dataType == TermTypes.METABOLITE_INTENSITY) {
				if (!ds.queries?.[q.dataType]) throw `no ${q.dataType} data on this dataset`
				if (!q.terms) throw `missing gene list`
				if (!Array.isArray(q.terms)) throw `gene list is not an array`
				// TODO: there should be a fix on the client-side to handle this error more gracefully,
				// instead of emitting the client-side instructions from the server response and forcing a reload
				if (q.terms.length < 3)
					throw `A minimum of three genes is required for clustering. Please refresh this page to clear this error.`
				result = (await getResult(q, ds)) as TermdbClusterResponse
			} else {
				throw 'unknown q.dataType ' + q.dataType
			}
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			} as TermdbClusterResponse
		}
		res.send(result)
	}
}

async function getResult(q: TermdbClusterRequest, ds: any) {
	let _q: any = q // may assign adhoc flag, use "any" to avoid tsc err and no need to include the flag in the type doc

	if (q.dataType == TermTypes.GENE_EXPRESSION) {
		// gdc gene exp clustering analysis is restricted to max 1000 cases, this is done at ds.queries.geneExpression.get() in mds3.gdc.js. the same getter also serves non-clustering requests and that should not limit cases. add this flag to be able to conditionally limit cases in get()
		_q = JSON.parse(JSON.stringify(q))
		_q.forClusteringAnalysis = true
	}

	const { term2sample2value, byTermId, bySampleId } = await ds.queries[q.dataType].get(_q) // too strong assumption on queries[dt], may not work for single cell

	if (term2sample2value.size == 0) throw 'no data'
	if (term2sample2value.size == 1) {
		// get data for only 1 gene; still return data, may create violin plot later
		const g = Array.from(term2sample2value.keys())[0]
		return { term: { gene: g, type: TermTypes.GENE_EXPRESSION }, data: term2sample2value.get(g) } as SingletermResponse
	}

	// have data for multiple genes, run clustering
	const t = Date.now() // use "t=new Date()" will lead to tsc error
	const clustering: Clustering = await doClustering(term2sample2value, q)
	if (serverconfig.debugmode) console.log('clustering done:', Date.now() - t, 'ms')
	return { clustering, byTermId, bySampleId } as ValidResponse
}

async function doClustering(data: any, q: TermdbClusterRequest) {
	// get set of unique sample names, to generate col_names dimension
	const sampleSet = new Set()
	/* make one pass of whole matrix to collect complete set of samples from all genes
	this is fast and no performance concern
	also as a safeguard against genes that is completely blank (gdc), and possible to be missing data for some samples
	*/
	for (const o of data.values()) {
		// o: {sampleId: value}
		for (const s in o) sampleSet.add(s)
	}
	if (sampleSet.size == 0) throw 'termdb.cluster: no samples'

	// Checking if cluster and distance method for hierarchial clustering is valid
	if (!clusterMethodLst.find(i => i.value == q.clusterMethod)) throw 'Invalid cluster method'
	if (!distanceMethodLst.find(i => i.value == q.distanceMethod)) throw 'Invalid distance method'

	const inputData = {
		matrix: [] as number[][],
		row_names: [] as string[], // genes
		col_names: [...sampleSet] as string[], // samples
		cluster_method: q.clusterMethod as string,
		distance_method: q.distanceMethod as string,
		plot_image: false // When true causes cluster.rs to plot the image into a png file (EXPERIMENTAL)
	}

	// compose "data{}" into a matrix
	for (const [gene, o] of data) {
		inputData.row_names.push(gene)
		const row: number[] = []
		for (const s of inputData.col_names) {
			const val = o[s] || 0
			if (typeof val !== 'number') throw val + ' is not a number'
			row.push(val)
		}
		inputData.matrix.push(getZscore(row))
	}

	if (inputData.matrix.length == 0) throw 'Clustering matrix is empty'
	//console.log("inputData:", inputData)
	//fs.writeFile('test.txt', JSON.stringify(inputData), function (err) {
	//	// For catching input to R clustering pipeline, in case of an error
	//	if (err) return console.log(err)
	//})
	const Routput = JSON.parse(
		await run_R(path.join(serverconfig.binpath, 'utils', 'hclust.R'), JSON.stringify(inputData))
	)

	const row_names_index: number[] = Routput.RowOrder.map(row => inputData.row_names.indexOf(row.name)) // sorted rows. value is array index in input data
	const col_names_index: number[] = Routput.ColOrder.map(col => inputData.col_names.indexOf(col.name)) // sorted columns, value is array index from input array

	// generated sorted matrix based on row/col clustering order
	const output_matrix: number[][] = []
	for (const rowI of row_names_index) {
		const newRow: number[] = []
		for (const colI of col_names_index) {
			newRow.push(inputData.matrix[rowI][colI])
		}
		output_matrix.push(newRow)
	}

	return {
		row: {
			merge: Routput.RowMerge,
			height: Routput.RowHeight,
			order: Routput.RowOrder,
			inputOrder: inputData.row_names
		},
		col: {
			merge: Routput.ColumnMerge,
			height: Routput.ColumnHeight,
			order: Routput.ColOrder,
			inputOrder: inputData.col_names
		},
		matrix: output_matrix
	}
}
function getZscore(l: number[]) {
	const mean: number = l.reduce((sum, v) => sum + v, 0) / l.length
	const sd: number = Math.sqrt(l.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / l.length)

	if (sd == 0) {
		return l
	}
	return l.map(v => (v - mean) / sd)
}

export async function validate_query_geneExpression(ds: any, genome: any) {
	const q: GeneExpressionQuery = ds.queries.geneExpression
	if (!q) return
	q.geneExpression2bins = {} //this dict is used to store the default bin config for each gene searched, so it doesn't have to be recalculated each time

	if (q.src == 'gdcapi') {
		gdc_validate_query_geneExpression(ds as GeneExpressionQueryGdc, genome)
		// q.get() added
		return
	}
	if (q.src == 'native') {
		await validateNative(q as GeneExpressionQueryNative, ds, genome)
		return
	}
	throw 'unknown queries.geneExpression.src'
}

async function validateNative(q: GeneExpressionQueryNative, ds: any, genome: any) {
	if (!q.file.startsWith(serverconfig.tpmasterdir)) q.file = path.join(serverconfig.tpmasterdir, q.file)
	if (!q.samples) q.samples = []
	await utils.validate_tabixfile(q.file)
	q.nochr = await utils.tabix_is_nochr(q.file, null, genome)
	q.samples = [] as number[]

	{
		// is a gene-by-sample matrix file
		const lines = await utils.get_header_tabix(q.file)
		if (!lines[0]) throw 'header line missing from ' + q.file
		const l = lines[0].split('\t')
		if (l.slice(0, 4).join('\t') != '#chr\tstart\tstop\tgene') throw 'header line has wrong content for columns 1-4'
		for (let i = 4; i < l.length; i++) {
			const id = ds.cohort.termdb.q.sampleName2id(l[i])
			if (id == undefined) throw 'queries.geneExpression: unknown sample from header: ' + l[i]
			q.samples.push(id)
		}
	}

	q.get = async (param: TermdbClusterRequestGeneExpression) => {
		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, must still return expected structure with no data
			return { term2sample2value: new Set(), byTermId: {}, bySampleId: {} }
		}

		// has at least 1 sample passing filter and with exp data
		// TODO what if there's just 1 sample not enough for clustering?
		const bySampleId = {}
		const samples = q.samples || []
		if (limitSamples) {
			for (const sid of limitSamples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		} else {
			// use all samples with exp data
			for (const sid of samples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		}

		// only valid genes with data are added. invalid genes or genes missing from data file is not added. backend returned genes is allowed to be fewer than supplied by client
		const term2sample2value = new Map() // k: gene symbol, v: { sampleId : value }

		for (const geneTerm of param.terms) {
			if (!geneTerm.gene) continue
			if (!geneTerm.chr || !Number.isInteger(geneTerm.start) || !Number.isInteger(geneTerm.stop)) {
				// need to supply chr/start/stop to query
				// legacy fpkm files
				// will not be necessary once these files are retired
				const re = getResultGene(genome, { input: geneTerm.gene, deep: 1 })
				if (!re.gmlst || re.gmlst.length == 0) {
					console.warn('unknown gene:' + geneTerm.gene) // TODO unknown genes should be notified to client
					continue
				}
				const i = re.gmlst.find(i => i.isdefault) || re.gmlst[0]
				geneTerm.start = i.start
				geneTerm.stop = i.stop
				geneTerm.chr = i.chr
			}

			const s2v = {}
			if (!geneTerm.chr || !Number.isInteger(geneTerm.start) || !Number.isInteger(geneTerm.stop))
				throw 'missing chr/start/stop'
			await utils.get_lines_bigfile({
				args: [
					q.file,
					(q.nochr ? geneTerm.chr.replace('chr', '') : geneTerm.chr) + ':' + geneTerm.start + '-' + geneTerm.stop
				],
				callback: line => {
					const l = line.split('\t')
					// case-insensitive match! FIXME if g.gene is alias won't work
					if (l[3].toLowerCase() != geneTerm.gene.toLowerCase()) return
					for (let i = 4; i < l.length; i++) {
						const sampleId = samples[i - 4]
						if (limitSamples && !limitSamples.has(sampleId)) continue // doing filtering and sample of current column is not used
						if (!l[i]) continue // blank string
						const v = Number(l[i])
						if (Number.isNaN(v)) throw 'exp value not number'
						s2v[sampleId] = v
					}
				}
			})
			if (Object.keys(s2v).length) term2sample2value.set(geneTerm.gene, s2v) // only add gene if has data
		}
		// pass blank byTermId to match with expected output structure
		const byTermId = {}
		if (term2sample2value.size == 0) throw 'no data available for the input ' + param.terms?.map(g => g.gene).join(', ')
		return { term2sample2value, byTermId, bySampleId }
	}
}
