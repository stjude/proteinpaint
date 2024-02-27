import fs from 'fs'
import path from 'path'
import { read_file } from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import { SingleCellQuery, SingleCellSamplesNative, SingleCellDataNative } from '#shared/types/dataset.ts'
import {
	Sample,
	TermdbSinglecellsamplesRequest,
	TermdbSinglecellsamplesResponse
} from '#shared/types/routes/termdb.singlecellSamples.ts'
import { Cell, Plot } from '#shared/types/routes/termdb.singlecellData.ts'
import { gdc_validate_query_singleCell_samples, gdc_validate_query_singleCell_data } from '#src/mds3.gdc.js'

/* route returns list of samples with sc data
this is due to the fact that sometimes not all samples in a dataset has sc data
*/

export const api: any = {
	endpoint: 'termdb/singlecellSamples',
	methods: {
		get: {
			init,
			request: {
				typeId: 'TermdbSinglecellsamplesRequest'
			},
			response: {
				typeId: 'TermdbSinglecellsamplesResponse'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q = req.query as TermdbSinglecellsamplesRequest
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleCell) throw 'no singlecell data on this dataset'
			result = (await ds.queries.singleCell.samples.get(q)) as TermdbSinglecellsamplesResponse
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			} as TermdbSinglecellsamplesResponse
		}
		res.send(result)
	}
}

/////////////////// ds query validator
export async function validate_query_singleCell(ds: any, genome: any) {
	const q = ds.queries.singleCell as SingleCellQuery
	if (!q) return

	if (q.samples.src == 'gdcapi') {
		gdc_validate_query_singleCell_samples(ds, genome)
	} else if (q.samples.src == 'native') {
		getSamplesNative(q.samples as SingleCellSamplesNative, ds)
	} else {
		throw 'unknown singleCell.samples.src'
	}
	// q.samples.get() added

	if (q.data.src == 'gdcapi') {
		gdc_validate_query_singleCell_data(ds, genome)
	} else if (q.data.src == 'native') {
		getDataNative(q.data as SingleCellDataNative, ds)
	} else {
		throw 'unknown singleCell.data.src'
	}
	// q.data.get() added
}

async function getSamplesNative(S: SingleCellSamplesNative, ds: any) {
	// for now use this quick fix method to pull sample ids annotated by this term
	// to support situation where not all samples from a dataset has sc data
	const isSamples = ds.cohort.termdb.q.getAllValues4term(S.isSampleTerm)
	if (isSamples.size == 0) throw 'no samples found that are identified by isSampleTerm'
	const samples = [] as any // array of samples with sc data to be sent to client and list in table; cannot use Sample type for the use of "sampleid" temp property
	for (const sampleid of isSamples.keys()) {
		if (isSamples.get(sampleid) == '1')
			samples.push({
				sample: ds.cohort.termdb.q.id2sampleName(sampleid), // string name for display
				sampleid // temporarily kept to assign term value to each sample
			})
	}
	if (S.sampleColumns) {
		// has optional terms to show as table columns and annotate samples
		for (const term of S.sampleColumns) {
			const s2v = ds.cohort.termdb.q.getAllValues4term(term.termid) // map. k: sampleid, v: term value
			for (const s of samples) {
				if (s2v.has(s.sampleid)) s[term.termid] = s2v.get(s.sampleid)
			}
		}
	}
	for (const s of samples) delete s.sampleid

	S.get = () => {
		return { samples: samples as Sample[] }
	}
}

function getDataNative(D: SingleCellDataNative, ds: any) {
	const nameSet = new Set() // guard against duplicating plot names
	for (const plot of D.plots) {
		if (nameSet.has(plot.name)) throw 'duplicate plot.name'
		nameSet.add(plot.name)
	}

	// scoped and cached for runtime
	const _terms = [] as any

	for (const tid of D.termIds) {
		const t = ds.cohort.termdb.q.termjsonByOneid(tid)
		if (!t) throw 'invalid term id from queries.singleCell.data.termIds[]'
		_terms.push(t)
	}
	D.get = async q => {
		// if sample is int, may convert to string
		try {
			const tid2cellvalue = {}
			for (const tid of D.termIds) tid2cellvalue[tid] = {} // k: cell id, v: cell value for this term
			const plots = [] as Plot[] // given a sample name, collect every plot data for this sample and return
			for (const plot of D.plots) {
				const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder, q.sample + plot.fileSuffix)
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
				const lines = (await read_file(tsvfile)).trim().split('\n')
				// 1st line is header
				const cells = [] as Cell[]
				for (let i = 1; i < lines.length; i++) {
					// each line is a cell
					const l = lines[i].split('\t')
					const cellId = l[0],
						x = Number(l[plot.coordsColumns.x]), // FIXME standardize, or define idx in plot
						y = Number(l[plot.coordsColumns.y])
					const category = l[plot.colorColumn?.index] || ''
					if (!cellId) throw 'cell id missing'
					if (!Number.isFinite(x) || !Number.isFinite(y)) throw 'x/y not number'
					cells.push({ cellId, x, y, category })

					for (const tid of D.termIds) {
						tid2cellvalue[tid][cellId] = l[1]
					}
				}
				plots.push({ name: plot.name, cells, colorBy: plot.colorColumn?.name, colorMap: plot.colorMap })
			}
			if (plots.length == 0) {
				// no data available for this sample
				return { nodata: true }
			}
			return { plots, terms: _terms, tid2cellvalue }
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			return { error: e.message || e }
		}
	}
}
