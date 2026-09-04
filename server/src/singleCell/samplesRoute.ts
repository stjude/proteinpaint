import type {
	SCImages,
	SingleCellQuery,
	SingleCellData,
	SingleCellGeneExpression,
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
import { read_file, file_is_readable, illegalpath } from '#src/utils.js'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '#src/serverconfig.js'
import { validGenomeDs } from '#routes/common.ts'
import { validate_query_singleCell_DEgenes } from './DEgenesRoute.ts'
import { SINGLECELL_CELLTYPE } from '#types'
import { mayLimitSamples } from '#src/mds3.filter.js'
import { maySetMapParent2Children } from '#src/termdb.matrix.js'
import { SingleCellMetaCache } from './SingleCellMetaCache.ts'
import { run_python } from '@sjcrh/proteinpaint-python'
import { validatePseudobulk } from './validatePseudobulk.ts'
import type { ReqQueryAddons } from '#routes/types.js'
import initBinConfig from '#shared/termdb.initbinconfig.js'

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
// _genome is unused since the GDC geneExpression getter moved to ppgdc, but mds3.init.js calls every
// validator uniformly as (ds, genome) -- keep the arity, per the same precedent in termdb.cluster.ts
export async function validate_query_singleCell(ds: any, _genome: any): Promise<void> {
	const q: SingleCellQuery = ds.queries.singleCell
	if (!q) return

	// validates all settings of single-cell dataset

	// validate required q.samples{}
	if (typeof q.samples != 'object') throw new Error('singleCell.samples{} not object')
	if (typeof q.data != 'object') throw new Error('singleCell.data{} not object')

	/* A ds either supplies a getter, or gets the built-in file-based one added below. That choice
	drives what data{} has to declare, and the two requirements differ:
	- plots[] is needed by every ds, since colorColumn2terms() below reads it unconditionally
	- plot.folder is needed only by the built-in file-based paths: validateSamples() (runs when there
	  is no samples.get) and validateDataNative() (runs when there is no data.get). A ds supplying
	  both getters serves from an api and has no folders (gdc)
	Check both up front so a misconfigured ds fails at init with a clear message, rather than later
	inside path.join() or colorColumn2terms(). */
	const hasDsSamplesGetter = typeof q.samples.get == 'function'
	const hasDsDataGetter = typeof q.data.get == 'function'
	validateDataPlots(q.data, !hasDsSamplesGetter || !hasDsDataGetter)

	if (!hasDsSamplesGetter) await validateSamples(q, ds) // added q.samples.get()

	if (!hasDsDataGetter) validateDataNative(q.data, ds) // added q.data.get()
	colorColumn2terms(ds.queries.singleCell.data.plots, ds) // convert colorBy columns defined in ds file to term objects for use in vocabApi methods later

	if (ds.queries.singleCell?.pseudobulk) {
		//** NOTE This will not work for the gdc */
		await validatePseudobulk(ds)
	}

	if (q.geneExpression) {
		if (typeof q.geneExpression != 'object') throw new Error('singleCell.geneExpression not object')
		// bins cache. termdb.getDefaultBins.js indexes it unconditionally, so seed it here rather than
		// in the native validator only -- ds-supplied getters (gdc) need it too
		if (!q.geneExpression.sample2gene2expressionBins) q.geneExpression.sample2gene2expressionBins = {}
		if (typeof q.geneExpression.get != 'function') validateGeneExpressionNative(q.geneExpression)
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
		D = q.data as SingleCellData

	// k: sample integer id
	// v: { sample: string name, tid1:v1, ...} term ids are from S.sampleColumns[]. list of sample objects are returned in getter
	const samples = new Map()
	/** Shared lookups for filtered sample IDs, sample-name resolution, and
	 * meta-result cellId->sample mappings used by other routes. */
	const metaCache = new SingleCellMetaCache()
	for (const plot of D.plots) {
		if (plot.isMetaResult) {
			const hasSample = plot?.colorColumns?.find(c => c.name === 'Sample')
			if (!hasSample) {
				console.log(
					`Skipping meta analysis result ${plot.name} due to no Sample color column. Please add a color column entry for the sample column.`
				)
				continue
			}
			/** Meta analysis results may not be separated into folders like the sample files
			 * for other plots. Check the file exists with the appropriate "sample name". This
			 * method ensure the file can be queried as intended later.
			 *
			 * Note: meta analysis results are treated as sample because the data structure and
			 * getters are the same. The results or the sID used for querying will not appear
			 * in the db. */
			const sampleName = plot?.sampleId || plot.name.replace(/\s/g, '_')
			const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder!, sampleName + (plot.fileSuffix || ''))
			try {
				/** Files should exist for each meta analysis result. */
				await file_is_readable(tsvfile)
				samples.set(sampleName, { sample: sampleName, isMetaResult: true })
				const t0 = Date.now()
				const text = await read_file(tsvfile)
				const t1 = Date.now()
				mayLog(ds.label, 'sc meta read file time:', t1 - t0)
				const idxs = {
					cell: plot.cellIdx ?? 0,
					sample: hasSample?.index ?? 1,
					x: plot.coordsColumns.x,
					y: plot.coordsColumns.y,
					cellType: plot.cellTypeColumn?.index
				}
				metaCache.addMetaResult(sampleName, text, idxs, ds.cohort.termdb.q.sampleName2id)
				if (metaCache.cellTypeFractions.size) {
					// cell type fractions have been computed
					// create cell type fraction terms
					const cellType2sample2fraction = metaCache.cellTypeFractions
					const cellTypeFractionTerms: any[] = []
					// iterating over plot.cellType2label to preserve order of cell types
					if (!plot.cellType2label) throw new Error('plot.cellType2label is undefined')
					for (const [cellType, label] of plot.cellType2label) {
						const sample2fraction = cellType2sample2fraction.get(cellType)
						if (!sample2fraction) throw new Error('cell type not found')
						const values = [...sample2fraction.values()]
						const term = {
							id: cellType,
							name: label,
							type: 'float',
							cellType,
							bins: {
								default: initBinConfig(values),
								min: Math.min(...values),
								max: Math.max(...values)
							}
						}
						cellTypeFractionTerms.push(term)
					}
					// inject terms into ds dictionary
					if (!D.addCellTypeFractionTerms) throw new Error('missing addCellTypeFractionTerms() method')
					D.addCellTypeFractionTerms(cellTypeFractionTerms, ds)
					// cache term data
					if (!ds.termid2sample2value) ds.termid2sample2value = new Map()
					for (const term of cellTypeFractionTerms) {
						const sample2fraction = cellType2sample2fraction.get(term.cellType)
						ds.termid2sample2value.set(term.id, sample2fraction)
					}
				}
				mayLog(ds.label, 'sc meta caching time:', Date.now() - t0)
			} catch (e: any) {
				throw new Error(`meta result data file missing or unreadable: ${sampleName} (${tsvfile}): ${e.message || e}`)
			}
			continue
		}
		for (const fn of await fs.promises.readdir(path.join(serverconfig.tpmasterdir, plot.folder!))) {
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
			metaCache.registerCohortSample(sampleName, sid)
		}

		if (!plot.colorColumns || plot.colorColumns.length == 0) continue
	}
	if (samples.size == 0) throw new Error('no scrna samples found')
	S.sampleMappingCache = metaCache
	if (metaCache.metaIdMap.size) D.metaIdMap = metaCache.metaIdMap

	// samples map populated with samples with sc data
	if (S.sampleColumns) {
		// has optional terms to show as table columns and annotate samples; pull sample values and assign
		for (const { termid } of S.sampleColumns) {
			// get term obj to verify termid
			const term = ds.cohort.termdb.q.termjsonByOneid(termid)
			if (!term) throw new Error(`unknown termid=${termid} from singlecell.samples.sampleColumns[]`)
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
			re.samples = Array.from(tmp as Set<string>).map(s => {
				if (samples.has(s)) return samples.get(s)
				const sampleIntId = metaCache.sampleName2IntId.get(s)
				if (samples.has(sampleIntId)) return samples.get(sampleIntId)
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
		const filteredSampleIds = (await mayLimitSamples(arg, Array.from(metaCache.sampleIntIds), ds)) || new Set()

		// Convert cohort sample IDs to sample names
		const result = new Set<string>()
		for (const sid of filteredSampleIds) {
			const sampleName = metaCache.sampleIntId2Name.get(sid)
			if (sampleName) result.add(sampleName)
		}
		if (includeMeta) {
			for (const metaResultName of metaCache.metaResultNames) {
				result.add(metaResultName)
			}
		}
		return result
	}
}

/** plots[] and plot.folder are optional on the type, since a ds supplying both getters needs no
 * folders. Enforce here what the ds actually has to declare, given which getters it supplied.
 * @param D ds.queries.singleCell.data{}
 * @param needFolders true when a built-in file-based path will run and read plot.folder
 */
function validateDataPlots(D: SingleCellData, needFolders: boolean): void {
	if (!Array.isArray(D.plots)) throw new Error('singleCell.data.plots[] missing')
	const nameSet = new Set() // guard against duplicating plot names
	for (const plot of D.plots) {
		if (nameSet.has(plot.name)) throw new Error('duplicate plot.name')
		nameSet.add(plot.name)
		if (needFolders && !plot.folder) throw new Error('plot.folder missing')
	}
}

/** The sample id from the request becomes a path segment under tpmasterdir. path.join() honors "../",
 * so an unscreened id escapes tpmasterdir -- worst on the checkPlotAvailability path, whose
 * file_is_readable() then reports back whether an arbitrary path exists. Screen it the same way the
 * sibling route does (termdb.singleSampleMutation.ts). Native sample names come from file names in
 * plot.folder, so illegalpath()'s whitespace/quote rules never reject a legitimate one.
 * @param sample req.query.sample {sID, eID}
 */
function validSampleId(sample: any): string {
	const id = sample?.eID || sample?.sID
	if (typeof id != 'string' || !id || illegalpath(id)) throw new Error('invalid sample id')
	return id
}

/** Adds ds.queries.singleCell.data.get() on init(), for a ds that does not supply its own getter.
 * @param D ds.queries.singleCell.data{}
 * @param ds Entire dataset configuration from the ds file
 */
function validateDataNative(D: SingleCellData, ds: any): void {
	// caches files contents between requests so each file is only loaded once
	const file2Lines = {} // key: file path, value: string[]

	D.get = async (q: TermdbSingleCellDataRequest & ReqQueryAddons) => {
		const sampleId = validSampleId(q.sample)
		/** Only return plots with available data files. */
		if (q.checkPlotAvailability) {
			return await getAvailablePlots(q.plots, D.plots, ds, sampleId)
		}
		let geneExpMap
		if (ds.queries.singleCell.geneExpression && q.gene) {
			const sample = q.sample || q.singleCellPlot.sample
			if (!sample) throw new Error('sample is required for gene expression query')
			geneExpMap = await ds.queries.singleCell.geneExpression.get(q, sample, q.gene)
		}
		const checkGeneExpMap = geneExpMap && Object.keys(geneExpMap).length > 0
		// given a sample name, collect every plot data for this sample and return
		const plots: Plot[] = []
		for (const plot of D.plots) {
			if (!q.plots.includes(plot.name)) continue
			//some plots share the same file, just read different columns
			const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder!, sampleId + (plot.fileSuffix || ''))
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

				if (checkGeneExpMap) {
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
		const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder!, sampleId + (plot.fileSuffix || ''))
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

/** Adds ds.queries.singleCell.geneExpression.get() on init(), for a ds that does not supply its own getter.
 * @param G ds.queries.singleCell.geneExpression
 */
function validateGeneExpressionNative(G: SingleCellGeneExpression): void {
	// folder is optional on the type, since a ds supplying get() has no use for it. without a
	// getter it is required, so enforce here
	if (!G.folder) throw new Error('singleCell.geneExpression.folder missing')
	// per-sample rds files are not validated up front, and simply used as-is on the fly

	G.get = async (_q: TermdbSingleCellDataRequest & ReqQueryAddons, sample: any, gene: string) => {
		// _q is the caller's request, forwarded only so a ds-supplied getter can read auth/abort off it;
		// sample and gene are explicit because callers query by a term's sample/gene, not the request's
		const h5file = path.join(serverconfig.tpmasterdir, G.folder!, validSampleId(sample) + '.h5')
		await file_is_readable(h5file)

		const query_gene = gene
		if (!query_gene) {
			throw new Error('Gene parameter is undefined')
		}
		const read_hdf5_input_type = { query: [query_gene], hdf5_file: h5file }

		const time1 = Date.now()
		const python_output = await run_python('readHDF5.py', JSON.stringify(read_hdf5_input_type))
		mayLog('Time taken to query HDF5 file:', Date.now() - time1, 'ms')
		const result = JSON.parse(python_output)
		const out = result.query_output[query_gene]?.samples
		if (!out) throw new Error(`No expression data for ${query_gene}`)

		return out
	}

	G.listGenes = async (sample: any) => {
		// per-sample assay type comes from the store's own 'assay' attribute:
		// a panel-based sample answers its assayed gene list, so a search box
		// offers/validates exactly those; a whole-transcriptome sample (no
		// attribute — every pre-existing file) answers no list, and gene
		// search stays on the genome gene db
		const h5file = path.join(serverconfig.tpmasterdir, G.folder!, validSampleId(sample) + '.h5')
		await file_is_readable(h5file)
		const out = JSON.parse(await run_python('readHDF5.py', JSON.stringify({ hdf5_file: h5file, list_items: true })))
		if (!Array.isArray(out.items)) throw new Error(out.message || 'failed to list the expression store genes')
		if (out.assay == null || out.assay == 'wholeTranscriptome') return { assay: 'wholeTranscriptome' as const }
		if (out.assay == 'panel') return { assay: 'panel' as const, genes: out.items }
		throw new Error(`invalid expression store assay: ${String(out.assay)}`)
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
