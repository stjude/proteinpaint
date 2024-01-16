import path from 'path'
import fs from 'fs'
import lines2R from '#src/lines2R.js'
import {
	TermdbClusterRequest,
	TermdbClusterResponse,
	Clustering,
	ValidResponse,
	SinglegeneResponse
} from '#shared/types/routes/termdb.cluster.ts'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { GeneExpressionQuery, GeneExpressionQueryNative } from '#shared/types/dataset.ts'
import { gdc_validate_query_geneExpression } from '#src/mds3.gdc.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { dtgeneexpression } from '#shared/common.js'

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
				throw 'The server has not finished caching the case IDs: try again in ~2 minutes'
			if (q.dataType == dtgeneexpression) {
				if (!ds.queries?.geneExpression) throw 'no geneExpression data on this dataset'
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
	const { gene2sample2value, byTermId, bySampleId } = await ds.queries.geneExpression.get(q)
	if (gene2sample2value.size == 0) throw 'no data'
	if (gene2sample2value.size == 1) {
		// get data for only 1 gene; still return data, may create violin plot later
		const g = Array.from(gene2sample2value.keys())[0]
		return { gene: g, data: gene2sample2value.get(g) } as SinglegeneResponse
	}

	// have data for multiple genes, run clustering
	const t = Date.now() // use "t=new Date()" will lead to tsc error
	const clustering: Clustering = await doClustering(gene2sample2value, q)
	if (serverconfig.debugmode) console.log('clustering done:', Date.now() - t, 'ms')
	return { clustering, byTermId, bySampleId } as ValidResponse
}

async function doClustering(data: any, q: TermdbClusterRequest) {
	// get set of unique sample names, to generate col_names dimension
	const sampleSet = new Set()
	for (const o of data.values()) {
		// {sampleId: value}
		for (const s in o) sampleSet.add(s)
		break
	}

	const inputData = {
		matrix: [] as number[][],
		row_names: [] as string[], // genes
		col_names: [...sampleSet] as string[], // samples
		cluster_method: q.clusterMethod as string,
		plot_image: false // When true causes cluster.rs to plot the image into a png file (EXPERIMENTAL)
	}

	// compose "data{}" into a matrix
	for (const [gene, o] of data) {
		inputData.row_names.push(gene)
		const row: number[] = []
		for (const s of inputData.col_names) {
			row.push(o[s] || 0)
		}
		inputData.matrix.push(getZscore(row))
	}

	const Rinputfile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	await utils.write_file(Rinputfile, JSON.stringify(inputData))
	const Routput = JSON.parse(await lines2R(path.join(serverconfig.binpath, 'utils/hclust.R'), [], [Rinputfile]))
	fs.unlink(Rinputfile, (arg: any) => {
		return
	})

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
	const q = ds.queries.geneExpression as GeneExpressionQuery
	if (!q) return

	if (q.src == 'gdcapi') {
		gdc_validate_query_geneExpression(ds, genome)
		// q.get() added
		return
	}
	if (q.src == 'native') {
		validateNative(q, ds, genome)
		return
	}
	throw 'unknown queries.geneExpression.src'
}

async function validateNative(q: GeneExpressionQueryNative, ds: any, genome: any) {
	q.file = path.join(serverconfig.tpmasterdir, q.file)
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
			if (id == undefined) throw 'unknown sample from header'
			q.samples.push(id)
		}
		console.log(q.samples.length, 'samples from geneExpression of', ds.label)
	}

	/*
	query exp data one gene at a time
	param{}
	.genes[{}]
		.gene=str
		.chr=str
		.start=int
		.stop=int
	.filterObj{}
	*/
	q.get = async (param: TermdbClusterRequest) => {
		const limitSamples = await mayLimitSamples(param, q.samples, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, must still return expected structure with no data
			return { gene2sample2value: new Set(), byTermId: {}, bySampleId: {} }
		}

		// has at least 1 sample passing filter and with exp data
		// TODO what if there's just 1 sample not enough for clustering?
		const bySampleId = {}
		if (limitSamples) {
			for (const sid of limitSamples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		} else {
			// use all samples with exp data
			for (const sid of q.samples) {
				bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
			}
		}

		const gene2sample2value = new Map() // k: gene symbol, v: { sampleId : value }

		for (const g of param.genes) {
			// FIXME newly added geneVariant terms from client to be changed to {gene} but not {name}
			if (!g.gene) continue

			if (!g.chr) {
				// quick fix: newly added gene from client will lack chr/start/stop
				const lst = genome.genedb.getjsonbyname.all(g.gene)
				if (lst.length == 0) continue
				const j = JSON.parse(lst.find(i => i.isdefault).genemodel || lst[0].genemodel)
				g.start = j.start
				g.stop = j.stop
				g.chr = j.chr
			}

			gene2sample2value.set(g.gene, {})
			await utils.get_lines_bigfile({
				args: [q.file, (q.nochr ? g.chr?.replace('chr', '') : g.chr) + ':' + g.start + '-' + g.stop], // must do g.chr?.replace to avoid tsc error
				callback: line => {
					const l = line.split('\t')
					// case-insensitive match! FIXME if g.gene is alias won't work
					if (l[3].toLowerCase() != g.gene.toLowerCase()) return
					for (let i = 4; i < l.length; i++) {
						const sampleId = q.samples[i - 4]
						if (limitSamples && !limitSamples.has(sampleId)) continue // doing filtering and sample of current column is not used
						// if l[i] is blank string?
						const v = Number(l[i])
						if (Number.isNaN(v)) throw 'exp value not number'
						gene2sample2value.get(g.gene)[sampleId] = v
					}
				}
			} as any)
			// Above!! add "as any" to suppress a npx tsc alert
		}
		// pass blank byTermId to match with expected output structure
		const byTermId = {}
		return { gene2sample2value, byTermId, bySampleId }
	}
}
