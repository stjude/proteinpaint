import fs from 'fs'
import path from 'path'
import { read_file, file_is_readable } from '#src/utils.js'
import { mayLog } from '#src/helpers.ts'
import { joinUrl } from '#shared/joinUrl.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import type {
	SingleCellQuery,
	SingleCellSamples,
	SingleCellDataNative,
	SingleCellGeneExpressionNative,
	SingleCellSample,
	TermdbSingleCellSamplesRequest,
	TermdbSingleCellSamplesResponse,
	Cell,
	Plot,
	TermdbSingleCellDataRequest,
	RouteApi
} from '#types'
import { termdbSingleCellSamplesPayload } from '#types/checkers'
import { validate_query_singleCell_DEgenes } from './termdb.singlecellDEgenes.ts'
import { gdc_validate_query_singleCell_data } from '#src/mds3.gdc.js'
import ky from 'ky'

/* route returns list of samples with sc data
this is due to the fact that sometimes not all samples in a dataset has sc data
*/

export const api: RouteApi = {
	endpoint: 'termdb/singlecellSamples',
	methods: {
		get: {
			...termdbSingleCellSamplesPayload,
			init
		},
		post: {
			...termdbSingleCellSamplesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: TermdbSingleCellSamplesRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell) throw 'no singlecell data on this dataset'
			result = await ds.queries.singleCell.samples.get(q)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			}
		}
		res.send(result satisfies TermdbSingleCellSamplesResponse)
	}
}

/////////////////// ds query validator
export async function validate_query_singleCell(ds: any, genome: any) {
	const q = ds.queries.singleCell as SingleCellQuery
	if (!q) return

	// validates all settings of single-cell dataset

	// validate required q.samples{}
	if (typeof q.samples != 'object') throw 'singleCell.samples{} not object'
	if (typeof q.samples.get == 'function') {
		// ds-supplied
	} else {
		// add q.samples.get() for native ds
		await validateSamplesNative(q.samples as SingleCellSamples, q.data as SingleCellDataNative, ds)
	}

	// validate required q.data{}
	if (typeof q.data != 'object') throw 'singleCell.data{} not object'
	if (q.data.src == 'gdcapi') {
		gdc_validate_query_singleCell_data(ds, genome) // todo change to ds-supplied q.data.get()
	} else if (q.data.src == 'native') {
		validateDataNative(q.data as SingleCellDataNative, ds)
	} else {
		throw 'unknown singleCell.data.src'
	}

	// validate optional settings below

	if (q.geneExpression) {
		if (typeof q.geneExpression != 'object') throw 'singleCell.geneExpression not object'
		if (q.geneExpression.src == 'native') {
			validateGeneExpressionNative(q.geneExpression as SingleCellGeneExpressionNative)
		} else if (q.geneExpression.src == 'gdcapi') {
			gdc_validateGeneExpression(q.geneExpression, ds, genome)
		} else {
			throw 'unknown singleCell.geneExpression.src'
		}
	}
	if (q.DEgenes) {
		if (typeof q.DEgenes != 'object') throw 'singleCell.DEgenes not object'
		validate_query_singleCell_DEgenes(ds)
	}

	if (q.images) {
		if (typeof q.images != 'object') throw 'singleCell.images not object'
		validateImages(q.images)
	}
}

function validateImages(images) {
	if (!images.folder) throw 'images.folder missing'
	if (!images.label) images.label = 'Images'
	if (!images.fileName) throw 'images.fileName missing'
}

async function validateSamplesNative(S: SingleCellSamples, D: SingleCellDataNative, ds: any) {
	// folder of every plot contains text files, one file per sample and named by sample names. each folder may contain variable number of samples. look into all folders to get union of samples as list of samples with sc data and return in this getter

	// k: sample integer id
	// v: { sample: string name, tid1:v1, ...} term ids are from S.sampleColumns[]. list of sample objects are returned in getter
	const samples = new Map()
	for (const plot of D.plots) {
		for (const fn of await fs.promises.readdir(path.join(serverconfig.tpmasterdir, plot.folder))) {
			// fn: string file name.
			let sampleName = fn
			if (plot.fileSuffix) {
				if (!fn.endsWith(plot.fileSuffix))
					throw `singlecell.sample file name ${fn} does not end with required suffix ${plot.fileSuffix}`
				sampleName = fn.split(plot.fileSuffix)[0]
			}
			if (!sampleName) throw `singlecell.sample: cannot derive sample name from file name ${fn}`
			const sid = ds.cohort.termdb.q.sampleName2id(sampleName)
			if (sid == undefined) throw `singlecell.sample: unknown sample name ${sampleName}`
			// is valid sample, add to holder
			samples.set(sid, { sample: sampleName })
		}
	}
	// samples map populated with samples with sc data
	if (S.sampleColumns) {
		// has optional terms to show as table columns and annotate samples; pull sample values and assign
		for (const term of S.sampleColumns) {
			const s2v = ds.cohort.termdb.q.getAllValues4term(term.termid) // map. k: sampleid, v: term value
			for (const [sid, v] of s2v.entries()) {
				if (!samples.has(sid)) continue // ignore sample without sc data
				samples.get(sid)[term.termid] = v
			}
		}
	}
	// FIXME must get q.filter and apply filter to list!!
	S.get = () => {
		return { samples: [...samples.values()] as SingleCellSample[] }
	}
}

function validateDataNative(D: SingleCellDataNative, ds: any) {
	const nameSet = new Set() // guard against duplicating plot names
	for (const plot of D.plots) {
		if (nameSet.has(plot.name)) throw 'duplicate plot.name'
		nameSet.add(plot.name)
		if (!plot.folder) throw 'plot.folder missing'
	}

	// caches files contents between requests so each file is only loaded once
	const file2Lines = {} // key: file path, value: string[]

	D.get = async (q: TermdbSingleCellDataRequest) => {
		// if sample is int, may convert to string
		const plots = [] as Plot[] // given a sample name, collect every plot data for this sample and return
		let geneExpMap
		if (ds.queries.singleCell.geneExpression && q.gene) {
			geneExpMap = await ds.queries.singleCell.geneExpression.get({ sample: q.sample, gene: q.gene })
		}
		for (const plot of D.plots) {
			if (!q.plots.includes(plot.name)) continue
			//some plots share the same file, just read different columns
			const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder, (q.sample.eID || q.sample.sID) + plot.fileSuffix)
			if (!file2Lines[tsvfile]) {
				await file_is_readable(tsvfile)
				const text = await read_file(tsvfile)
				const lines = text.trim().split('\n')
				let first = true
				const lines2 = [] as string[][]
				for (const line of lines) {
					if (first) {
						first = false
						continue
					}
					lines2.push(line.split('\t'))
				}
				file2Lines[tsvfile] = lines2
			}

			const colorColumn = plot.colorColumns.find(c => c.name == q.colorBy?.[plot.name]) || plot.colorColumns[0]
			const expCells = [] as Cell[]
			const noExpCells = [] as Cell[]

			for (const l of file2Lines[tsvfile]) {
				const cellId = l[0],
					x = Number(l[plot.coordsColumns.x]),
					y = Number(l[plot.coordsColumns.y])
				const category = l[colorColumn?.index] || ''
				if (!cellId) throw 'cell id missing'
				if (!Number.isFinite(x) || !Number.isFinite(y)) throw 'x/y not number'
				const cell: Cell = { cellId, x, y, category }
				if (geneExpMap) {
					if (geneExpMap[cellId] !== undefined) {
						cell.geneExp = geneExpMap[cellId]
						expCells.push(cell)
					} else {
						noExpCells.push(cell)
					}
				} else noExpCells.push(cell)
			}
			plots.push({
				name: plot.name,
				expCells,
				noExpCells,
				colorColumns: plot.colorColumns.map(c => c.name),
				colorBy: colorColumn?.name,
				colorMap: colorColumn?.colorMap
			})
		}
		if (plots.length == 0) {
			// no data available for this sample
			return { nodata: true }
		}

		return { plots }
	}
}

function validateGeneExpressionNative(G: SingleCellGeneExpressionNative) {
	G.sample2gene2expressionBins = {} // cache for binning gene expression values
	// per-sample rds files are not validated up front, and simply used as-is on the fly

	G.get = async (q: TermdbSingleCellDataRequest) => {
		// q {sample:str, gene:str}
		const h5file = path.join(serverconfig.tpmasterdir, G.folder, (q.sample.eID || q.sample.sID) + '.h5')
		await file_is_readable(h5file)

		const read_hdf5_input_type = { gene: q.gene, hdf5_file: h5file }

		let out // object of barcodes as keys, and values as value
		try {
			const time1 = Date.now()
			const rust_output = await run_rust('readHDF5', JSON.stringify(read_hdf5_input_type))
			mayLog('Time taken to query HDF5 file:', Date.now() - time1, 'ms')
			for (const line of rust_output.split('\n')) {
				if (line.startsWith('output_string:')) {
					out = JSON.parse(line.replace('output_string:', ''))
				} else {
					console.log(line)
				}
			}
		} catch (e) {
			// arg should be an error string; if needed generate sanitised version by not showing file path

			// possible for gene not found in hdf5. in such case rust will return lengthy error including file path which we do not want to show on client.
			if (typeof e == 'string') {
				const geneNotFound = `Gene '${q.gene}' not found in the HDF5 file`
				// if the substring exists in rust error, means the gene is not found. throw a simple msg to alert downstream
				if (e.includes(geneNotFound)) throw 'No expression data for this gene'
			}
			// encountered other error
			console.log(e)
			throw 'error reading h5 file: ' + e
		}

		return out
	}
}

function gdc_validateGeneExpression(G, ds, genome) {
	G.sample2gene2expressionBins = {} // cache for binning gene expression values
	// client actually queries /termdb/singlecellData route for gene exp data
	G.get = async (q: TermdbSingleCellDataRequest) => {
		// q {sample: {eID: str, sID: str}, gene:str}

		/* GDC scrna gene expression API expects:
			{
				file_id: hdf5id
				gene_ids: Ensembl gene ID
			}

			API accepts either hdf5 file_id or case uuid
			however, when case uuid provided has multiple files, will throw error: 
				"case *** has more than one associated gene expression file"
			so should always use hdf5id 
		*/
		try {
			const fileid = q.sample.eID
			if (ds.__gdc.scrnaAnalysis2hdf5.size == 0) {
				// blank map. must be that gdc data caching is disabled; no need to detect if it's being cached because this particular query is very fast
				throw 'GDC scRNA file mapping is not cached'
			}
			const hdf5id = ds.__gdc.scrnaAnalysis2hdf5.get(fileid)
			if (!hdf5id) throw 'cannot map eID to hdf5 id'

			const aliasLst = genome.genedb.getAliasByName.all(q.gene)
			const gencodeId = aliasLst.find(a => a?.alias.toUpperCase().startsWith('ENSG'))?.alias
			if (!gencodeId) throw 'cannot map gene symbol to GENCODE'

			const body = {
				gene_ids: [gencodeId],
				file_id: hdf5id
			}

			const { host } = ds.getHostHeaders(q)

			const t = Date.now()
			const response = await ky.post(joinUrl(host.rest, 'scrna_seq/gene_expression'), { timeout: false, json: body })
			if (!response.ok) throw `HTTP Error: ${response.status} ${response.statusText}`
			const out = await response.json()
			mayLog('gdc scrna gene exp', q.gene, Date.now() - t)

			const result = (out as { data: { cells: any[] }[] }).data[0].cells
			const data = {}
			for (const r of result) {
				data[r.cell_id] = r.value
			}
			return data
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			return { error: 'GDC scRNAseq gene expression request failed with error: ' + (e.message || e) }
		}
	}
}
