import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { read_file, get_header_txt } from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import {
	SingleCellQuery,
	SingleCellSamplesNative,
	SingleCellDataNative,
	SingleCellGeneExpressionNative
} from '#shared/types/dataset.ts'
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
		validateSamplesNative(q.samples as SingleCellSamplesNative, ds)
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
			// TODO
		} else {
			throw 'unknown singleCell.geneExpression.src'
		}
		// q.geneExpression.get() added
	}
}

async function validateSamplesNative(S: SingleCellSamplesNative, ds: any) {
	// for now use this quick fix method to pull sample ids annotated by this term
	// to support situation where not all samples from a dataset has sc data
	const samples = {}
	if (S.sampleColumns) {
		// has optional terms to show as table columns and annotate samples
		for (const term of S.sampleColumns) {
			const s2v = ds.cohort.termdb.q.getAllValues4term(term.termid) // map. k: sampleid, v: term value
			for (const [s, v] of s2v.entries()) {
				if (!samples[s]) samples[s] = { sample: ds.cohort.termdb.q.id2sampleName(s) }
				samples[s][term.termid] = v
			}
		}
	}

	S.get = () => {
		return { samples: Object.values(samples) as Sample[] }
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
				const tsvfile = path.join(serverconfig.tpmasterdir, plot.folder, q.sample + plot.fileSuffix)
				//some plots share the same file, just read different columns
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
					console.log('read file', tsvfile)
				}

				const lines = file2Lines[tsvfile]
				// 1st line is header
				const cells = [] as Cell[]
				for (let i = 1; i < lines.length; i++) {
					// each line is a cell
					const l = lines[i].split('\t')
					const cellId = lines.length > 3 ? l[0] : undefined,
						x = Number(l[plot.coordsColumns.x]), // FIXME standardize, or define idx in plot
						y = Number(l[plot.coordsColumns.y])
					//if(l.length <= 3) continue //not enough columns

					const category = l[plot.colorColumn?.index] || ''
					if (!cellId) throw 'cell id missing'
					if (!Number.isFinite(x) || !Number.isFinite(y)) throw 'x/y not number'
					const cell: Cell = { cellId, x, y, category }
					if (geneExpMap) {
						if (geneExpMap[cellId] !== undefined) {
							cell.geneExp = geneExpMap[cellId]
						}
					}
					cells.push(cell)
				}
				plots.push({ name: plot.name, cells, colorBy: plot.colorColumn?.name, colorMap: plot.colorColumn?.colorMap })
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

	// per-sample matrix files are not validated up front, but are verified on the fly. subject to change
	G.get = async (q: any) => {
		// q {sample:str, gene:str}
		const tsvfile = path.join(serverconfig.tpmasterdir, G.folder, q.sample)
		const cell2value = {} // data returned by getter. key: cell barcode in header, value: exp value

		try {
			await fs.promises.stat(tsvfile)
		} catch (e: any) {
			return cell2value
			//throw 'geneExp matrix file not found or readable for this sample'
			// do not throw when matrix file is unreabable, but returns blank data. this simplifies client logic
		}
		const header = (await get_header_txt(tsvfile)).split('\t')
		if (header.length == 0) throw 'blank header line'
		await grepMatrix4geneExpression(tsvfile, q.gene, header, cell2value)
		return cell2value
	}
}

function grepMatrix4geneExpression(tsvfile: string, gene: string, header: string[], cell2value: any) {
	return new Promise((resolve, reject) => {
		const cp = spawn('grep', ['-m', '1', gene + '\t', tsvfile])
		const out: string[] = [],
			err: string[] = []
		cp.stdout.on('data', d => out.push(d))
		cp.stderr.on('data', d => err.push(d))
		cp.on('close', () => {
			const e = err.join('')
			if (e) reject(e)
			// got data

			const line = out.join('').trim() // should find one line of text
			if (!line) {
				// blank line. gene is not found and missed out in this experiment
				resolve(null) // add null to avoid tsc err
			}

			const l = line.split('\t')
			if (l.length != header.length)
				reject(`number of fields differ between data line and header: ${l.length} ${header.length}`)

			for (let i = 1; i < l.length; i++) {
				const v = Number(l[i])
				if (Number.isNaN(v)) continue // invalid value
				cell2value[header[i]] = v
			}
			resolve(null)
		})
	})
}
