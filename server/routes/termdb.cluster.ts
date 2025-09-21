import path from 'path'
import { run_R } from '@sjcrh/proteinpaint-r'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import type {
	TermdbClusterRequestGeneExpression,
	TermdbClusterRequest,
	TermdbClusterResponse,
	Clustering,
	ValidResponse,
	SingletermResponse,
	GeneExpressionQuery,
	GeneExpressionQueryNative,
	GeneExpressionQueryGdc,
	RouteApi
} from '#types'
import { termdbClusterPayload } from '#types/checkers'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { gdc_validate_query_geneExpression } from '#src/mds3.gdc.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { clusterMethodLst, distanceMethodLst } from '#shared/clustering.js'
import { TermTypes, NUMERIC_DICTIONARY_TERM } from '#shared/terms.js'
import { getData } from '#src/termdb.matrix.js'
import { termType2label } from '#shared/terms.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared/time.js'

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
			// TODO: generalize to any dataset
			if (ds.label === 'GDC' && !ds.__gdc?.doneCaching)
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
		res.send(result satisfies TermdbClusterRequest)
	}
}

async function getResult(q: TermdbClusterRequest, ds: any) {
	let _q: any = q // may assign adhoc flag, use "any" to avoid tsc err and no need to include the flag in the type doc

	if (q.dataType == TermTypes.GENE_EXPRESSION) {
		// gdc gene exp clustering analysis is restricted to max 1000 cases, this is done at ds.queries.geneExpression.get() in mds3.gdc.js. the same getter also serves non-clustering requests and that should not limit cases. add this flag to be able to conditionally limit cases in get()
		_q = JSON.parse(JSON.stringify(q))
		_q.forClusteringAnalysis = true
	}

	let term2sample2value, byTermId, bySampleId, skippedSexChrGenes

	if (q.dataType == NUMERIC_DICTIONARY_TERM) {
		;({ term2sample2value, byTermId, bySampleId } = await getNumericDictTermAnnotation(q, ds))
	} else {
		;({ term2sample2value, byTermId, bySampleId, skippedSexChrGenes } = await ds.queries[q.dataType].get(_q))
	}

	/* remove term with a sample2value map of size 0 from term2sample2value
	such term will cause all samples to be dropped from clustering plot
	this has two practical applications with gdc:
	1. local testing with gdc using inconsistent gencode versions (gdc:36). for some genes local will use a geneid not found in gdc and cause issue for clustering
	2. somehow in v36 genedb there can still be geneid not in gdc. this helps avoid app crashing in gdc environment
	*/
	const noValueTerms: string[] = []
	for (const [term, obj] of term2sample2value) {
		if (Object.keys(obj).length === 0) {
			const tw = q.terms.find(t => t.$id == term)
			const termName = !tw ? term : tw.term.type == 'geneExpression' ? tw.term.gene : tw.term.name
			noValueTerms.push(termName)
			term2sample2value.delete(term)
			delete byTermId[term]
		}
	}

	const removedHierClusterTerms: { text: string; lst: string[] }[] = [] // allow to collect multiple sets of skipped items, each based on different reasons
	if (noValueTerms.length) {
		removedHierClusterTerms.push({
			text: `Skipped ${q.dataType == TermTypes.GENE_EXPRESSION ? 'genes' : 'items'} with no data`,
			lst: noValueTerms
		})
	}
	if (skippedSexChrGenes?.length) {
		// this is gdc-specific
		removedHierClusterTerms.push({ text: 'Skipped sex chromosome genes', lst: skippedSexChrGenes })
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
	mayLog('clustering done:', formatElapsedTime(Date.now() - t))
	const result = { clustering, byTermId, bySampleId } as ValidResponse
	if (removedHierClusterTerms.length) result.removedHierClusterTerms = removedHierClusterTerms
	return result
}

async function getNumericDictTermAnnotation(q, ds) {
	const getDataArgs = {
		terms: q.terms.map(term => ({ term, q: { mode: 'continuous' } })),
		filter: q.filter,
		filter0: q.filter0,
		__protected__: q.__protected__
	}
	const data = await getData(getDataArgs, ds)

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
	const Routput = JSON.parse(await run_R('hclust.R', JSON.stringify(inputData)))

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
		await validateNative(q as GeneExpressionQueryNative, ds)
		return
	}
	throw 'unknown queries.geneExpression.src'
}

/**
 * Query values for a specific item(gene, gene set) or set of items from a new format HDF5 file
 * @param {string} hdf5_file - Path to the HDF5 file
 * @param {string[]} query - Array of item names (genes or gene sets) to query
 * @returns {Promise<Object>} Promise resolving to the queried data
 */
async function queryHDF5(hdf5_file, query) {
	// Create the input params as a JSON object
	const jsonInput = JSON.stringify({
		hdf5_file: hdf5_file,
		query: query
	})

	try {
		// Call the Rust script with input parameters
		const result = await run_rust('readH5', jsonInput)

		// Check if the result exists and contains sample data
		if (!result || result.length === 0) {
			throw new Error('Failed to retrieve expression data: Empty or missing response')
		}

		return result
	} catch (error) {
		console.error(`Error querying HDF5 for ${query}`)
		throw error
	}
}

/**
 * Validate and prepare a gene expression query
 * This function handles both HDF5 and tabix file formats
 * If HDF5 validation fails, it falls back to tabix handling
 *
 * @param q - The gene expression query
 * @param ds - Dataset information
 */
async function validateNative(q: GeneExpressionQueryNative, ds: any) {
	q.file = path.join(serverconfig.tpmasterdir, q.file)
	q.samples = []

	try {
		// Validate that the HDF5 file exists
		await utils.file_is_readable(q.file)
		const tmp = await run_rust('readH5', JSON.stringify({ hdf5_file: q.file, validate: true }))

		const vr = JSON.parse(tmp)

		if (vr.status !== 'success') throw vr.message
		if (!vr.samples?.length) throw 'HDF5 file has no samples, please check file.'
		for (const sn of vr.samples) {
			const si = ds.cohort.termdb.q.sampleName2id(sn)
			if (si == undefined) throw `unknown sample ${sn} from HDF5 ${q.file}`
			q.samples.push(si)
		}
		console.log(`${ds.label}: geneExpression HDF5 file validated. Format: ${vr.format}, Samples:`, vr.samples.length)
	} catch (error) {
		throw `${ds.label}: Failed to validate geneExpression HDF5 file: ${error}`
	}

	// HDF5 validation successful, set up the getter function
	q.get = async (param: TermdbClusterRequestGeneExpression) => {
		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// Got 0 sample after filtering, must still return expected structure with no data
			return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} }
		}

		// Set up sample IDs and labels
		const bySampleId = {}
		const samples = q.samples || []
		if (limitSamples) {
			for (const sid of limitSamples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		} else {
			// Use all samples with exp data
			for (const sid of samples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		}

		// Initialize data structure
		const term2sample2value = new Map()
		const byTermId = {}

		// First, collect all gene names
		const geneNames: string[] = []
		for (const tw of param.terms) {
			if (tw.term.gene) {
				geneNames.push(tw.term.gene)
			}
		}

		if (geneNames.length === 0) {
			console.log('No genes to query')
			return { term2sample2value, byTermId }
		}

		const time1 = Date.now()

		// Query expression values for all genes at once
		const geneData = JSON.parse(await queryHDF5(q.file, geneNames))

		mayLog('Time taken to run gene query:', formatElapsedTime(Date.now() - time1))

		const genesData = geneData.query_output || {}
		if (!genesData) throw 'No expression data returned from HDF5 query'
		for (const tw of param.terms) {
			if (!tw.term.gene) continue

			// Get this gene's data from the batch response
			const geneResult = genesData[tw.term.gene]
			if (!geneResult) {
				console.warn(`No data found for gene ${tw.term.gene} in the response`)
				continue
			}

			// Extract just the samples data
			const samplesData = geneResult.samples || {}
			// Convert the gene data to the expected format
			const s2v = {}

			for (const sampleName in samplesData) {
				const sampleId = ds.cohort.termdb.q.sampleName2id(sampleName)
				if (!sampleId) continue
				if (limitSamples && !limitSamples.has(sampleId)) continue
				s2v[sampleId] = samplesData[sampleName]
			}

			if (Object.keys(s2v).length) {
				term2sample2value.set(tw.$id, s2v)
			}
		}
		if (term2sample2value.size == 0) {
			throw 'No data available for the input ' + param.terms?.map(tw => tw.term.gene).join(', ')
		}

		return { term2sample2value, byTermId, bySampleId }
	}
}
