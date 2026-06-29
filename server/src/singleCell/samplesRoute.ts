import type {
	SCImages,
	SingleCellQuery,
	SingleCellDataNative,
	SingleCellGeneExpressionGdc,
	SingleCellGeneExpressionNative,
	SingleCellPlot,
	SingleCellSample,
	TermdbSingleCellSamplesRequest,
	TermdbSingleCellSamplesResponse,
	Cell,
	Plot,
	TermdbSingleCellDataRequest,
	Filter,
	RoutePayload,
	RouteApi
} from '#types'
import fs from 'fs'
import path from 'path'
import ky from 'ky'
import { read_file, file_is_readable } from '#src/utils.js'
import { mayLog } from '#src/helpers.ts'
import { joinUrl } from '#shared/joinUrl.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import { validGenomeDs } from '#routes/common.ts'
import { validate_query_singleCell_DEgenes } from './DEgenesRoute.ts'
import { gdc_validate_query_singleCell_data } from '#src/mds3.gdc.js'
import { SINGLECELL_CELLTYPE } from '#shared/terms.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { maySetMapParent2Children } from '#src/termdb.matrix.js'

export const payload: RoutePayload = {
	init,
	request: {
		typeId: 'TermdbSingleCellSamplesRequest',
		checker: validTermdbSingleCellSamplesRequest
	},
	response: { typeId: 'TermdbSingleCellSamplesResponse' }
}

/* route returns list of samples with sc data
this is due to the fact that sometimes not all samples in a dataset has sc data
*/

export const api: RouteApi = {
	endpoint: 'termdb/singlecellSamples',
	methods: {
		get: payload,
		post: payload
	}
}

function validTermdbSingleCellSamplesRequest(input): TermdbSingleCellSamplesRequest {
	return {
		...validGenomeDs(input),
		filter: input.filter ? (input.filter as Filter) : undefined, // TODO: use a filter validator
		filter0: input.filter0 as any
	}
}

export function init({ genomes }) {
	return async (req, res): Promise<void> => {
		const q: TermdbSingleCellSamplesRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets[q.dslabel]
			if (!ds) throw new Error('invalid dataset name')
			if (!ds.queries?.singleCell) throw new Error('no singlecell data on this dataset')
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
//runs during mds3.init()
export async function validate_query_singleCell(ds: any, genome: any): Promise<void> {
	const q: SingleCellQuery = ds.queries.singleCell
	if (!q) return

	// validates all settings of single-cell dataset

	// validate required q.samples{}
	if (typeof q.samples != 'object') throw new Error('singleCell.samples{} not object')
	if (typeof q.data != 'object') throw new Error('singleCell.data{} not object')

	if (typeof q.samples.get == 'function') {
		// ds-supplied
	} else {
		await validateSamples(q, ds)
		// added q.samples.get()
	}

	// validate required q.data{}
	if (q.data.src == 'gdcapi') {
		gdc_validate_query_singleCell_data(ds, genome) // todo change to ds-supplied q.data.get()
	} else if (q.data.src == 'native') {
		validateDataNative(q.data as SingleCellDataNative, ds)
		// added q.data.get()
	} else {
		throw new Error('unknown singleCell.data.src')
	}
	colorColumn2terms(ds.queries.singleCell.data.plots, ds) // convert colorBy columns defined in ds file to term objects for use in vocabApi methods later

	if (q.geneExpression) {
		if (typeof q.geneExpression != 'object') throw new Error('singleCell.geneExpression not object')
		if (q.geneExpression.src == 'native') {
			validateGeneExpressionNative(q.geneExpression as SingleCellGeneExpressionNative)
		} else if (q.geneExpression.src == 'gdcapi') {
			gdc_validateGeneExpression(q.geneExpression as SingleCellGeneExpressionGdc, ds, genome)
		} else {
			throw new Error('unknown singleCell.geneExpression.src')
		}
	}
	if (q.DEgenes) {
		if (typeof q.DEgenes != 'object') throw new Error('singleCell.DEgenes not object')
		validate_query_singleCell_DEgenes(ds)
	}

	if (q.images) {
		if (typeof q.images != 'object') throw new Error('singleCell.images not object')
		validateImages(q.images)
	}
}

function validateImages(images: SCImages): void {
	if (!images.folder) throw new Error('images.folder missing')
	if (!images.label) images.label = 'Images'
	if (!images.fileName) throw new Error('images.fileName missing')
}

/** Runs on mds3.init()
 * - Adds ds.queries.singleCell.samples.get() for native ds (see route init() above).
 * - Adds ds.queries.singleCell.samples.getFilteredSingleCellSamples() for filtering
 * samples based on cohort level terms.
 * - Adds ds.queries.singleCell.terms which is list of all possible colorBy terms
 * defined in the ds file, for use in vocabApi methods later.
 * @param q ds.queries.singleCell. ***NOT** the req.query
 * @param ds Entire dataset configuration from the ds file
 */
async function validateSamples(q: SingleCellQuery, ds: any): Promise<void> {
	// folder of every plot contains text files, one file per sample and named by sample names. each folder may contain variable number of samples. look into all folders to get union of samples as list of samples with sc data and return in this getter
	const S: SingleCellQuery['samples'] = q.samples,
		D = q.data as SingleCellDataNative

	// k: sample integer id
	// v: { sample: string name, tid1:v1, ...} term ids are from S.sampleColumns[]. list of sample objects are returned in getter
	const samples = new Map()
	/** Create lookups for getFilteredSingleCellSamples. Created on server
	 * init for performance.
	 *
	 * Captures ids and names that may exist only in a meta result file but
	 * there is no corresponding tsv file. Do not include in samples map which
	 * returns samples with available files. */
	const sampleIntIds = new Set()
	const sampleIntId2Name = new Map() // maps numeric cohort ID to sample name
	const sampleName2IntId = new Map() // maps sample name to numeric cohort ID
	for (const plot of D.plots) {
		if (plot.isMetaResult) {
			/** Meta analysis files are read on init to create a sample name 2 cell id
			 * 2 sample id map. The map is a lookup for data getters to retrieve the
			 * sampleId to match with cohort level terms. Attaching the map to
			 * ds.queries.singleCell.data allows getters (e.g. getData() in termdb.matrix)
			 * access to when needed.
			 * Becomes <plotName(i.e metaResultID), <cellId, sampleId >> */
			if (!D.metaIdMap) D.metaIdMap = new Map()
			/** Meta analysis results may not be separated into folders like the sample files
			 * for other plots. Check the file exists with the appropriate "sample name". This
			 * method ensure the file can be queried as intended later.
			 *
			 * Note: meta analysis results are treated as sample because the data structure and
			 * getters are the same. The results or the sID used for querying will not appear
			 * in the db. */
			const sampleName = plot?.sampleId || plot.name.replace(/\s/g, '_')
			const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder, sampleName + (plot.fileSuffix || ''))
			try {
				/** Files should exist for each meta analysis result. */
				await file_is_readable(tsvfile)
				samples.set(sampleName, { sample: sampleName, isMetaResult: true })
				const text = await read_file(tsvfile)
				const lines = text.trim().split('\n')
				const cellIdMap = new Map()
				for (let i = 1; i < lines.length; i++) {
					const [cellId, sampleId] = lines[i].split('\t').map(s => s.trim())
					if (!cellId) throw new Error(`meta result row missing, index = ${i}, cell id: ${cellId}`)
					if (!sampleId) throw new Error(`meta result row missing sample id, index = ${i}, sample id: ${sampleId}`)
					cellIdMap.set(cellId, sampleId)
					// Treat sampleId from file as a sample name and look up the cohort sample ID
					const sampleIntId = ds.cohort.termdb.q.sampleName2id(sampleId)
					if (sampleIntId !== undefined) {
						sampleIntIds.add(sampleIntId)
						sampleIntId2Name.set(sampleIntId, sampleId)
						sampleName2IntId.set(sampleId, sampleIntId)
					}
				}
				D.metaIdMap.set(sampleName, cellIdMap)
			} catch (e: any) {
				throw new Error(`meta result data file missing or unreadable: ${sampleName} (${tsvfile}): ${e.message || e}`)
			}
			continue
		}
		for (const fn of await fs.promises.readdir(path.join(serverconfig.tpmasterdir, plot.folder))) {
			// fn: string file name.
			let sampleName = fn
			if (plot.fileSuffix) {
				if (!fn.endsWith(plot.fileSuffix))
					throw new Error(`singlecell.sample file name ${fn} does not end with required suffix ${plot.fileSuffix}`)
				sampleName = fn.split(plot.fileSuffix)[0]
			}
			if (!sampleName) throw new Error(`singlecell.sample: cannot derive sample name from file name ${fn}`)
			const sid = ds.cohort.termdb.q.sampleName2id(sampleName)
			if (sid == undefined) throw new Error(`singlecell.sample: unknown sample name ${sampleName}`)
			// is valid sample, add to holder
			samples.set(sid, { sample: sampleName })
			/** Add to lookups for filtering. This is a fallback if no meta results */
			sampleIntIds.add(sid)
			sampleIntId2Name.set(sid, sampleName)
			sampleName2IntId.set(sampleName, sid)
		}

		if (!plot.colorColumns || plot.colorColumns.length == 0) continue
	}
	if (samples.size == 0) throw new Error('no scrna samples found')

	// samples map populated with samples with sc data
	if (S.sampleColumns) {
		// has optional terms to show as table columns and annotate samples; pull sample values and assign
		for (const { termid } of S.sampleColumns) {
			// get term obj to verify termid
			const term = ds.cohort.termdb.q.termjsonByOneid(termid)
			if (!term) throw new Error('unknown termid from singlecell.samples.sampleColumns[]')
			const s2v = await ds.cohort.termdb.q.getAllValues4term(termid) // map. k: sampleid, v: term value
			for (const [sid, v] of s2v.entries()) {
				if (!samples.has(sid)) continue // ignore sample without sc data
				samples.get(sid)[termid] = term.values?.[v]?.label || v
			}
		}
	}

	const _samples = [...samples.values()] as SingleCellSample[]

	S.get = async (_q: TermdbSingleCellSamplesRequest) => {
		const re: any = { samples: _samples }
		if (_q.filter?.lst?.length || _q.filter0) {
			const tmp = await S.getFilteredSingleCellSamples!(_q, true)
			re.samples = Array.from(tmp).map(s => {
				if (samples.has(s)) return samples.get(s)
				else if (samples.has(sampleName2IntId.get(s))) return samples.get(sampleName2IntId.get(s))
				else return { sample: s }
			})
		}
		if (q.metaResults) {
			// meta analysis results exist. pass it along with samples
			re.metaResults = q.metaResults.map(i => {
				return { name: i.name }
			})
		}
		return re
	}

	/** This function allows filtering by cohort level terms for the sample table in the SC
	 * app and meta results plots.
	 *
	 * *** NOTE: This logic accounts for when a sample id is present in the meta result file but
	 * a sample file is not available. It's possible this use case is seen in development only.
	 * If so, this logic can be simplified to only check for sample ids in the cohort. *** */
	S.getFilteredSingleCellSamples = async (
		_q: TermdbSingleCellSamplesRequest,
		includeMeta = false
	): Promise<Set<string>> => {
		if (!_q.filter && !_q.filter0) return new Set()
		const arg = { filter: _q.filter, filter0: _q.filter0 }
		// assuming single cell data is at sample level, so
		// setting mapParent2Children=true here to be able to
		// map patient-level data onto the single cell data
		maySetMapParent2Children(arg, ds, true)
		const filteredSampleIds = (await mayLimitSamples(arg, Array.from(sampleIntIds), ds)) || new Set()

		// Convert cohort sample IDs to sample names
		const result = new Set<string>()
		for (const sid of filteredSampleIds) {
			const sampleName = sampleIntId2Name.get(sid)
			if (sampleName) result.add(sampleName)
		}
		// Add meta result names if requested
		if (includeMeta) {
			for (const metaResultName of D.metaIdMap?.keys() || []) {
				result.add(metaResultName)
			}
		}
		return result
	}
}

/** Adds ds.queries.singleCell.data.get() on init().
 * Runs from termdb.singleCellData route when q.data.src is 'native'.
 * @param D ds.queries.singleCell.data{}
 * @param ds Entire dataset configuration from the ds file
 */
function validateDataNative(D: SingleCellDataNative, ds: any): void {
	const nameSet = new Set() // guard against duplicating plot names
	for (const plot of D.plots) {
		if (nameSet.has(plot.name)) throw new Error('duplicate plot.name')
		nameSet.add(plot.name)
		if (!plot.folder) throw new Error('plot.folder missing')
	}

	// caches files contents between requests so each file is only loaded once
	const file2Lines = {} // key: file path, value: string[]

	D.get = async (q: TermdbSingleCellDataRequest) => {
		const sampleId = q.sample?.eID || q.sample?.sID
		/** Only return plots with available data files. */
		if (q.checkPlotAvailability) {
			return await getAvailablePlots(q.plots, D.plots, ds, sampleId)
		}
		let geneExpMap
		if (ds.queries.singleCell.geneExpression && (q.genes || q.gene)) {
			const sample = q.sample || q.singleCellPlot.sample
			if (!sample) throw new Error('sample is required for gene expression query')
			if (q.gene && q.genes) throw new Error('cannot provide both gene and genes parameters')
			if (!q.genes) q.genes = []
			if (q.gene) q.genes = [q.gene]
			for (const gene of q.genes) {
				if (!gene) throw new Error('gene name is empty')
				const tmp = await ds.queries.singleCell.geneExpression.get({ sample, gene })
				geneExpMap = { ...geneExpMap, ...tmp }
			}
		}
		// given a sample name, collect every plot data for this sample and return
		const plots: Plot[] = []
		for (const plot of D.plots) {
			if (!q.plots.includes(plot.name)) continue
			//some plots share the same file, just read different columns
			const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder, sampleId + (plot.fileSuffix || ''))
			if (!file2Lines[tsvfile]) {
				await file_is_readable(tsvfile)
				const text = await read_file(tsvfile)
				const lines = text.trim().split('\n')
				let first = true
				const lines2: string[][] = []
				for (const line of lines) {
					if (first) {
						first = false
						continue
					}
					lines2.push(line.split('\t'))
				}
				file2Lines[tsvfile] = lines2
			}

			/**  TODO: colorBy obj created somewhere else. When found, need to standardize
			 * to avoid work around logic like this.*/
			const checkColorBy = typeof q.colorBy == 'string' ? q.colorBy : q.colorBy?.[plot.name]
			const colorColumn = plot.colorColumns.find(c => c.name == checkColorBy) || plot.colorColumns[0]

			const expCells: Cell[] = []
			const noExpCells: Cell[] = []

			for (const l of file2Lines[tsvfile]) {
				const cellId = l[0],
					x = Number(l[plot.coordsColumns.x]),
					y = Number(l[plot.coordsColumns.y])
				const category = l[colorColumn?.index] || ''
				if (!cellId) throw new Error('cell id missing')
				if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('x/y not number')
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

/** When q.checkPlotAvailability is true, returns only plots with available data files. */
async function getAvailablePlots(
	Qplots: string[],
	DsPlots: SingleCellPlot[],
	ds: any,
	sampleId: string
): Promise<{ plots: { name: string }[] }> {
	const plots: { name: string }[] = []
	for (const plot of DsPlots) {
		if (!Qplots.includes(plot.name)) continue
		if (plot.isMetaResult) {
			/** Check to see if the plot name is the same as the sampleId to
			 * prevent showing all meta analysis results when a single meta analysis
			 * result is selected as a sample. */
			const sampleName = plot?.sampleId || plot.name.replace(/\s/g, '_')
			if (sampleName != sampleId) continue
		}
		const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder, sampleId + (plot.fileSuffix || ''))
		try {
			await file_is_readable(tsvfile)
			// file exists for this sample
			plots.push({ name: plot.name })
		} catch (_) {
			// file doesn't exist for this sample. this is allowed
		}
	}
	const imgs = ds.queries.singleCell?.images
	if (imgs) {
		const imgFile = path.join(serverconfig.tpmasterdir, imgs.folder, sampleId, imgs.fileName)
		try {
			await file_is_readable(imgFile)
			plots.push({ name: imgs?.label || 'Image' })
		} catch (_) {
			// image doesn't exist for this sample.
		}
	}
	return { plots }
}

/** Adds ds.queries.singleCell.geneExpression.get() on init() if geneExpression.src is 'native'.
 * @param G ds.queries.singleCell.geneExpression
 */
function validateGeneExpressionNative(G: SingleCellGeneExpressionNative): void {
	G.sample2gene2expressionBins = {} // cache for binning gene expression values
	// per-sample rds files are not validated up front, and simply used as-is on the fly

	G.get = async (q: TermdbSingleCellDataRequest) => {
		// q {sample:str, gene:str}
		const h5file = path.join(serverconfig.tpmasterdir, G.folder, (q.sample?.eID || q.sample?.sID) + '.h5')
		await file_is_readable(h5file)

		const query_gene = q.gene
		if (!query_gene) {
			throw new Error('Gene parameter is undefined')
		}

		const read_hdf5_input_type = { query: [query_gene], hdf5_file: h5file }

		const time1 = Date.now()
		const rust_output = await run_rust('readH5', JSON.stringify(read_hdf5_input_type))
		mayLog('Time taken to query HDF5 file:', Date.now() - time1, 'ms')

		const result = JSON.parse(rust_output)
		const out = result.query_output[query_gene]?.samples
		if (!out) throw new Error(`No expression data for ${query_gene}`)

		return out
	}
}

/** Adds ds.queries.singleCell.geneExpression.get() on init() if geneExpression.src is 'gdcapi'.
 * @param G ds.queries.singleCell.geneExpression
 * @param ds entire ds config
 * @param genome entire genome config
 * */
function gdc_validateGeneExpression(G: SingleCellGeneExpressionGdc, ds: any, genome: any): void {
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
				throw new Error('GDC scRNA file mapping is not cached')
			}
			const hdf5id = ds.__gdc.scrnaAnalysis2hdf5.get(fileid)
			if (!hdf5id) throw new Error('cannot map eID to hdf5 id')

			const aliasLst = genome.genedb.getAliasByName.all(q.gene)
			const gencodeId = aliasLst.find(a => a?.alias.toUpperCase().startsWith('ENSG'))?.alias
			if (!gencodeId) throw new Error('cannot map gene symbol to GENCODE')
			const body = {
				gene_ids: [gencodeId],
				file_id: hdf5id
			}

			const { host, headers } = ds.getHostHeaders(q)

			const t = Date.now()
			const response = await ky.post(joinUrl(host.rest, 'scrna_seq/gene_expression'), {
				timeout: false,
				headers,
				json: body
			})
			if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`)
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

function colorColumn2terms(plots: SingleCellPlot[], ds: any): void {
	/** Collect all possible tws defined per plot and make available
	 * for vocabApi methods later.*/
	const termSet = new Set()
	for (const plot of plots) {
		/** Creates the tw obj from the existing color map and alias defined
		 * in the ds file. These will be available to the SC app on init().
		 *
		 * TODO: Consider creating these objs in the ds file.*/
		const tmpTerms = plot.colorColumns.map(c => {
			const baseValues = c.colorMap ? Object.keys(c.colorMap) : []
			return {
				name: c.name,
				isleaf: true,
				/** Note, term may apply to multiple plots.
				 * The plot denotes the data file defined in the ds file,
				 * which may be the same or different file paths for
				 * all the plots. */
				plot: plot.name,
				type: SINGLECELL_CELLTYPE,
				groupsetting: {},
				values: baseValues.reduce((acc, v) => {
					const alias = c?.aliases?.[v]
					acc[v] = {
						key: v,
						label: alias || v,
						color: c.colorMap?.[v] || '#000000'
					}
					return acc
				}, {})
			}
		})
		tmpTerms.forEach(term => termSet.add(term))
	}
	ds.queries.singleCell.terms = [...termSet]
}
