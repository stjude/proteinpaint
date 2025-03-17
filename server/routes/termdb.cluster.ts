import path from 'path'
import run_R from '#src/run_R.js'
import type {
	TermdbClusterRequest,
	TermdbClusterResponse,
	Clustering,
	ValidResponse,
	SingletermResponse,
	RouteApi
} from '#types'
import { termdbClusterPayload } from '#types/checkers'
import serverconfig from '#src/serverconfig.js'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering.js'
import { TermTypes, NUMERIC_DICTIONARY_TERM } from '#shared/terms.js'
import { getData } from '#src/termdb.matrix.js'
import { termType2label } from '#shared/terms.js'
import { mayLog } from '#src/helpers.ts'

export const api: RouteApi = {
	endpoint: 'termdb/cluster',
	methods: {
		get: {
			...termdbClusterPayload,
			init
		},
		post: {
			...termdbClusterPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: TermdbClusterRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (ds.__gdc && !ds.__gdc.doneCaching)
				throw 'The server has not finished caching the case IDs: try again in about 2 minutes.'
			if ([TermTypes.GENE_EXPRESSION, TermTypes.METABOLITE_INTENSITY, NUMERIC_DICTIONARY_TERM].includes(q.dataType)) {
				if (!ds.queries?.[q.dataType] && q.dataType !== NUMERIC_DICTIONARY_TERM)
					throw `no ${q.dataType} data on this dataset`
				if (!q.terms) throw `missing gene list`
				if (!Array.isArray(q.terms)) throw `gene list is not an array`
				// TODO: there should be a fix on the client-side to handle this error more gracefully,
				// instead of emitting the client-side instructions from the server response and forcing a reload
				if (q.terms.length < 3)
					throw `A minimum of three genes is required for clustering. Please refresh this page to clear this error.`
				result = (await getResult(q, ds, g)) as TermdbClusterResponse
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
		res.send(result satisfies TermdbClusterRequest)
	}
}

async function getResult(q: TermdbClusterRequest, ds: any, genome) {
	let _q: any = q // may assign adhoc flag, use "any" to avoid tsc err and no need to include the flag in the type doc

	if (q.dataType == TermTypes.GENE_EXPRESSION) {
		// gdc gene exp clustering analysis is restricted to max 1000 cases, this is done at ds.queries.geneExpression.get() in mds3.gdc.js. the same getter also serves non-clustering requests and that should not limit cases. add this flag to be able to conditionally limit cases in get()
		_q = JSON.parse(JSON.stringify(q))
		_q.forClusteringAnalysis = true
	}

	let term2sample2value, byTermId, bySampleId

	if (q.dataType == NUMERIC_DICTIONARY_TERM) {
		;({ term2sample2value, byTermId, bySampleId } = await getNumericDictTermAnnotation(q, ds, genome))
	} else {
		;({ term2sample2value, byTermId, bySampleId } = await ds.queries[q.dataType].get(_q))
	}

	/* remove term with a sample2value map of size 0 from term2sample2value
	such term will cause all samples to be dropped from clustering plot
	this has two practical applications with gdc:
	1. local testing with gdc using inconsistent gencode versions (gdc:36). for some genes local will use a geneid not found in gdc and cause issue for clustering
	2. somehow in v36 genedb there can still be geneid not in gdc. this helps avoid app crashing in gdc environment
	*/
	const removedHierClusterTerms: string[] = []
	for (const [term, obj] of term2sample2value) {
		if (Object.keys(obj).length === 0) {
			removedHierClusterTerms.push(term)
			term2sample2value.delete(term)
			delete byTermId[term]
		}
	}

	if (term2sample2value.size == 0) throw 'no data'
	if (term2sample2value.size == 1) {
		// get data for only 1 gene; still return data, may create violin plot later
		const g = Array.from(term2sample2value.keys())[0]
		return { term: { gene: g, type: TermTypes.GENE_EXPRESSION }, data: term2sample2value.get(g) } as SingletermResponse
	}

	// have data for multiple genes, run clustering
	const t = Date.now() // use "t=new Date()" will lead to tsc error
	const clustering: Clustering = await doClustering(term2sample2value, q, Object.keys(bySampleId).length)
	mayLog('clustering done:', Date.now() - t, 'ms')
	const result = { clustering, byTermId, bySampleId } as ValidResponse
	if (removedHierClusterTerms.length) result.removedHierClusterTerms = removedHierClusterTerms
	return result
}

async function getNumericDictTermAnnotation(q, ds, genome) {
	const getDataArgs = {
		filter: q.filter,
		terms: q.terms.map(term => ({ term, q: { mode: 'continuous' } }))
	}
	const data = await getData(getDataArgs, ds, genome)

	const term2sample2value = new Map()
	for (const [key, sampleData] of Object.entries(data.samples)) {
		for (const [term, value] of Object.entries(sampleData as { [key: string]: unknown })) {
			if (term !== 'sample') {
				// Skip the sample number
				if (!term2sample2value.has(term)) {
					term2sample2value.set(term, {})
				}
				term2sample2value.get(term)[key] = (value as { value: any }).value
			}
		}
	}
	return { term2sample2value, byTermId: data.refs.byTermId, bySampleId: data.refs.bySampleId }
}

// default numCases should be matched to maxCase4geneExpCluster in mds3.gdc.js
async function doClustering(data: any, q: TermdbClusterRequest, numCases = 1000) {
	// get set of unique sample names, to generate col_names dimension
	const sampleSet: Set<string> = new Set()
	// make one pass of whole matrix to collect samples that have values for all terms
	let firstTerm = true
	for (const o of data.values()) {
		// o: {sampleId: value}
		const currentSampleIds = new Set(Object.keys(o)) // Extract sample IDs from current term
		if (firstTerm) {
			// Initialize sampleSet with the first term's sample IDs
			currentSampleIds.forEach(id => sampleSet.add(id))
			firstTerm = false
		} else {
			// Intersect sampleSet with the current term's sample IDs
			for (const id of sampleSet) {
				if (!currentSampleIds.has(id)) {
					sampleSet.delete(id)
				}
			}
		}
	}

	if (sampleSet.size == 0)
		throw `termdb.cluster: There are no overlapping tested samples shared across the selected ${termType2label(
			q.dataType
		)}`

	// Checking if cluster and distance method for hierarchial clustering is valid
	if (!clusterMethodLst.find(i => i.value == q.clusterMethod)) throw 'Invalid cluster method'
	if (!distanceMethodLst.find(i => i.value == q.distanceMethod)) throw 'Invalid distance method'

	const inputData = {
		matrix: [] as number[][],
		row_names: [] as string[], // genes
		col_names: [...sampleSet].slice(0, numCases) as string[], // samples
		cluster_method: q.clusterMethod as string,
		distance_method: q.distanceMethod as string,
		plot_image: false // When true causes cluster.rs to plot the image into a png file (EXPERIMENTAL)
	}

	// compose "data{}" into a matrix
	for (const [gene, o] of data) {
		inputData.row_names.push(gene)
		const row: number[] = []
		for (const s of inputData.col_names) {
			row.push(o[s])
		}
		inputData.matrix.push(q.zScoreTransformation ? getZscore(row) : row)
	}

	if (inputData.matrix.length == 0) throw 'Clustering matrix is empty'
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