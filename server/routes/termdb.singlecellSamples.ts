import fs from 'fs'
import path from 'path'
import { read_file } from '#src/utils.js'
import run_R from '#src/run_R.js'
import { joinUrl, mayLog } from '#src/helpers.ts'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import type {
	SingleCellQuery,
	SingleCellSamplesNative,
	SingleCellDataNative,
	SingleCellGeneExpressionNative,
	Sample,
	TermdbSingleCellSamplesRequest,
	TermdbSingleCellSamplesResponse,
	Cell,
	Plot,
	TermdbSingleCellDataRequest,
	RouteApi
} from '#types'
import { termdbSingleCellSamplesPayload } from '#types/checkers'
import { validate_query_singleCell_DEgenes } from './termdb.singlecellDEgenes.ts'
import { gdc_validate_query_singleCell_samples, gdc_validate_query_singleCell_data } from '#src/mds3.gdc.js'
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
	if (q.samples.src == 'gdcapi') {
		gdc_validate_query_singleCell_samples(ds, genome)
	} else if (q.samples.src == 'native') {
		validateSamplesNative(q.samples as SingleCellSamplesNative, q.data as SingleCellDataNative, ds)
	} else {
		throw 'unknown singleCell.samples.src'
	}
	// q.samples.get() added

	if (q.data.src == 'gdcapi') {
		gdc_validate_query_singleCell_data(ds, genome)
	} else if (q.data.src == 'native') {
		validateDataNative(q.data as SingleCellDataNative, ds)
	} else {
		throw 'unknown singleCell.data.src'
	}
	// q.data.get() added

	if (q.geneExpression) {
		if (q.geneExpression.src == 'native') {
			validateGeneExpressionNative(q.geneExpression as SingleCellGeneExpressionNative)
		} else if (q.geneExpression.src == 'gdcapi') {
			gdc_validateGeneExpression(q.geneExpression, ds, genome)
		} else {
			throw 'unknown singleCell.geneExpression.src'
		}
		// q.geneExpression.get() added
	}

	if (q.DEgenes) {
		validate_query_singleCell_DEgenes(ds)
		// q.DEgenes.get() added
	}
}

async function validateSamplesNative(S: SingleCellSamplesNative, D: SingleCellDataNative, ds: any) {
	// folder of every plot contains text files, one file per sample and named by sample names. each folder may contain variable number of samples. look into all folders to get union of samples as list of samples with sc data and return in this getter

	// k: sample integer id
	// v: { sample: string name, tid1:v1, ...} term ids are from S.sampleColumns[]. list of sample objects are returned in getter
	const samples = new Map()
	for (const plot of D.plots) {
		try {
			for (const fn of await fs.promises.readdir(path.join(serverconfig.tpmasterdir, plot.folder))) {
				// fn: string file name.
				let sampleName = fn
				if (plot.fileSuffix) {
					if (!fn.endsWith(plot.fileSuffix)) continue // unrecognized file name, ignore
					sampleName = fn.split(plot.fileSuffix)[0]
				}
				if (!sampleName) continue // blank sample name (e.g. file name equals suffix), ignore
				const sid = ds.cohort.termdb.q.sampleName2id(sampleName)
				if (sid == undefined) continue // unknown sample name. ignore
				// is valid sample, add to holder
				samples.set(sid, { sample: sampleName })
			}
		} catch (e) {
			console.log('cannot readdir on singleCell.data.plot[].folder', e)
			// may register as ds init err
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
	S.get = () => {
		return { samples: [...samples.values()] as Sample[] }
	}
}

function validateDataNative(D: SingleCellDataNative, ds: any) {
	const nameSet = new Set() // guard against duplicating plot names
	for (const plot of D.plots) {
		if (nameSet.has(plot.name)) throw 'duplicate plot.name'
		nameSet.add(plot.name)
	}

	D.get = async q => {
		// if sample is int, may convert to string
		try {
			const plots = [] as Plot[] // given a sample name, collect every plot data for this sample and return
			let geneExpMap
			if (ds.queries.singleCell.geneExpression && q.gene) {
				geneExpMap = await ds.queries.singleCell.geneExpression.get({ sample: q.sample, gene: q.gene })
			}
			const file2Lines = {}
			for (const plot of D.plots) {
				if (!q.plots.includes(plot.name)) continue
				const tsvfile = path.join(
					serverconfig.tpmasterdir,
					plot.folder,
					(q.sample.eID || q.sample.sID) + plot.fileSuffix
				) //some plots share the same file, just read different columns
				if (!file2Lines[tsvfile]) {
					try {
						await fs.promises.stat(tsvfile)
					} catch (e: any) {
						if (e.code == 'ENOENT') {
							// no file found for this sample; allowed because sampleView tests if that sample has sc data or not
							continue
						}
						if (e.code == 'EACCES') throw 'cannot read file, permission denied'
						throw 'failed to load sc data file'
					}
					file2Lines[tsvfile] = (await read_file(tsvfile)).trim().split('\n')
				}
				const colorColumn = plot.colorColumns.find(c => c.name == q.colorBy?.[plot.name]) || plot.colorColumns[0]
				const lines = file2Lines[tsvfile]
				// 1st line is header
				const expCells = [] as Cell[]
				const noExpCells = [] as Cell[]

				for (let i = 1; i < lines.length; i++) {
					// each line is a cell
					const l = lines[i].split('\t')
					const cellId = lines.length > 3 ? l[0] : undefined,
						x = Number(l[plot.coordsColumns.x]), // FIXME standardize, or define idx in plot
						y = Number(l[plot.coordsColumns.y])
					//if(l.length <= 3) continue //not enough columns
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
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			return { error: e.message || e }
		}
	}
}

function validateGeneExpressionNative(G: SingleCellGeneExpressionNative) {
	G.sample2gene2expressionBins = {} // cache for binning gene expression values

	// per-sample rds files are not validated up front, and simply used as-is on the fly

	if (G.storage_type == 'RDS' || !G.storage_type) {
		// Check if the storage format is RDS file ? For now keeping this as the default format
		// client actually queries /termdb/singlecellData route for gene exp data
		G.get = async (q: TermdbSingleCellDataRequest) => {
			// q {sample: {eID: str, sID: str}, gene:str}
			const rdsfile = path.join(serverconfig.tpmasterdir, G.folder, (q.sample.eID || q.sample.sID) + '.rds')
			try {
				await fs.promises.stat(rdsfile)
			} catch (_) {
				return {}
				// do not throw when file is missing/unreabable, but returns blank data. this simplifies client logic
			}

			let out // object of barcodes as keys, and values as value
			try {
				out = JSON.parse(
					await run_R(path.join(serverconfig.binpath, 'utils', 'getGeneFromMatrix.R'), null, [rdsfile, q.gene])
				)
			} catch (_) {
				// if gene is not found will emit such msg
				return {}
			}
			return out
		}
	} else if (G.storage_type == 'HDF5') {
		// client actually queries /termdb/singlecellData route for gene exp data
		G.get = async (q: TermdbSingleCellDataRequest) => {
			// q {sample:str, gene:str}
			const rdsfile = path.join(serverconfig.tpmasterdir, G.folder, (q.sample.eID || q.sample.sID) + '.h5')
			try {
				await fs.promises.stat(rdsfile)
			} catch (_) {
				return {}
				// do not throw when file is missing/unreabable, but returns blank data. this simplifies client logic
			}

			const read_hdf5_input_type = { gene: q.gene, hdf5_file: rdsfile }

			let out // object of barcodes as keys, and values as value
			try {
				const time1 = new Date().valueOf()
				const rust_output = await run_rust('readHDF5', JSON.stringify(read_hdf5_input_type))
				const time2 = new Date().valueOf()
				console.log('Time taken to query HDF5 file:', time2 - time1, 'ms')
				for (const line of rust_output.split('\n')) {
					if (line.startsWith('output_string:')) {
						out = JSON.parse(line.replace('output_string:', ''))
					} else {
						console.log(line)
					}
				}
			} catch (_) {
				// if gene is not found will emit such msg
				return {}
			}

			return out
		}
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
			//const out = await ky.post(joinUrl(host.rest, 'scrna_seq/gene_expression'), { timeout: false, json: body }).json()
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
