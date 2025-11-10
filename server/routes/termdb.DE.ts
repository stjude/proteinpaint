import fs from 'fs'
import path from 'path'
import type { DERequest, DEResponse, ExpressionInput, RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { get_ds_tdb } from '../src/termdb.js'
import { run_R } from '@sjcrh/proteinpaint-r'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '../src/serverconfig.js'
import { imageSize } from 'image-size'
import { get_header_txt } from '#src/utils.js'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'

export const api: RouteApi = {
	endpoint: 'termdb/DE',
	methods: {
		get: {
			...diffExpPayload,
			init
		},
		post: {
			...diffExpPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome')
			const [ds] = get_ds_tdb(genome, q)
			let term_results: any = []
			if (q.tw) {
				const terms = [q.tw]
				term_results = await getData(
					{
						filter: q.filter,
						filter0: q.filter0,
						terms: terms
					},
					ds
				)

				if (term_results.error) throw new Error(term_results.error)
			}

			let term_results2: any = []
			if (q.tw2) {
				const terms2 = [q.tw2]
				term_results2 = await getData(
					{
						filter: q.filter,
						filter0: q.filter0,
						terms: terms2
					},
					ds
				)
				if (term_results2.error) throw new Error(term_results2.error)
			}

			const results = await run_DE(req.query as DERequest, ds, term_results, term_results2)
			if (!results || !results.data) throw new Error('No data available')
			res.send(results)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function run_DE(param: DERequest, ds: any, term_results: any, term_results2: any) {
	/*
param{}
samplelst{}
groups[]
values[] // using integer sample id
*/
	if (param.samplelst?.groups?.length != 2) throw new Error('.samplelst.groups.length!=2')
	if (param.samplelst.groups[0].values?.length < 1) throw new Error('samplelst.groups[0].values.length<1')
	if (param.samplelst.groups[1].values?.length < 1) throw new Error('samplelst.groups[1].values.length<1')
	// txt file uses string sample name, must convert integer sample id to string
	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw new Error('unknown data type for rnaseqGeneCount')
	if (!q.storage_type) throw new Error('storage_type is not defined') // This check is redundant because in ts this is already defined as a mandatory field. Still keeping it as a backup (when storage_type will be permanently switched to HDF5).
	param.storage_type = q.storage_type
	const group1names = [] as string[]
	const conf1_group1: (string | number)[] = []
	const conf2_group1: (string | number)[] = []
	for (const s of param.samplelst.groups[0].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (q.allSampleSet.has(n)) {
			if (param.tw && !param.tw2) {
				// When first confounding variable is defined but second is not
				if (term_results.samples[s.sampleId]) {
					// For some samples the confounding variables are not availble. Need to check!!!
					if (param.tw.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf1_group1.push(term_results.samples[s.sampleId][param.tw.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf1_group1.push(term_results.samples[s.sampleId][param.tw.$id]['key'])
					}
					group1names.push(n)
				}
			} else if (!param.tw && param.tw2) {
				// When first confounding variable is not defined but second is. Will later disable this option from UI so that second variable is only shown when first is defined
				if (term_results2.samples[s.sampleId]) {
					// For some samples the confounding variables are not availble. Need to check!!!
					if (param.tw2.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf2_group1.push(term_results2.samples[s.sampleId][param.tw2.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf2_group1.push(term_results2.samples[s.sampleId][param.tw2.$id]['key'])
					}
					group1names.push(n)
				}
			} else if (param.tw && param.tw2) {
				// When both confounding variables are defined
				if (term_results.samples[s.sampleId] && term_results2.samples[s.sampleId]) {
					if (param.tw.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf1_group1.push(term_results.samples[s.sampleId][param.tw.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf1_group1.push(term_results.samples[s.sampleId][param.tw.$id]['key'])
					}

					if (param.tw2.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf2_group1.push(term_results2.samples[s.sampleId][param.tw2.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf2_group1.push(term_results2.samples[s.sampleId][param.tw2.$id]['key'])
					}
					group1names.push(n)
				}
			} else {
				// When no confounding variables are present
				group1names.push(n)
			}
		}
	}
	const group2names = [] as string[]
	const conf1_group2: (string | number)[] = []
	const conf2_group2: (string | number)[] = []
	for (const s of param.samplelst.groups[1].values) {
		if (!Number.isInteger(s.sampleId)) continue
		const n = ds.cohort.termdb.q.id2sampleName(s.sampleId)
		if (!n) continue
		if (q.allSampleSet.has(n)) {
			if (param.tw && !param.tw2) {
				// When first confounding variable is defined but second is not
				if (term_results.samples[s.sampleId]) {
					// For some samples the confounding variables are not availble. Need to check!!!
					if (param.tw.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf1_group2.push(term_results.samples[s.sampleId][param.tw.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf1_group2.push(term_results.samples[s.sampleId][param.tw.$id]['key'])
					}
					group2names.push(n)
				}
			} else if (!param.tw && param.tw2) {
				// When first confounding variable is not defined but second is. Will later disable this option from UI so that second variable is only shown when first is defined
				if (term_results2.samples[s.sampleId]) {
					// For some samples the confounding variables are not availble. Need to check!!!
					if (param.tw2.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf2_group2.push(term_results2.samples[s.sampleId][param.tw2.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf2_group2.push(term_results2.samples[s.sampleId][param.tw2.$id]['key'])
					}
					group2names.push(n)
				}
			} else if (param.tw && param.tw2) {
				// When both confounding variables are defined
				if (term_results.samples[s.sampleId] && term_results2.samples[s.sampleId]) {
					if (param.tw.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf1_group2.push(term_results.samples[s.sampleId][param.tw.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf1_group2.push(term_results.samples[s.sampleId][param.tw.$id]['key'])
					}

					if (param.tw2.q.mode == 'continuous') {
						// When confounding variable is continuous use 'value'
						conf2_group2.push(term_results2.samples[s.sampleId][param.tw2.$id]['value'])
					} else {
						// When confounding variable is discrete use 'key'
						conf2_group2.push(term_results2.samples[s.sampleId][param.tw2.$id]['key'])
					}
					group2names.push(n)
				}
			} else {
				// When no confounding variables are present
				group2names.push(n)
			}
		}
	}

	const sample_size1 = group1names.length
	const sample_size2 = group2names.length

	const alerts = validateGroups(sample_size1, sample_size2, group1names, group2names)
	if (param.preAnalysis) {
		const group1Name = param.samplelst.groups[0].name
		const group2Name = param.samplelst.groups[1].name
		return {
			data: {
				[group1Name]: sample_size1,
				[group2Name]: sample_size2,
				...(alerts.length ? { alert: alerts.join(' | ') } : {})
			}
		}
	}
	//TODO: Change this to return an array and use invalid data UI on client
	if (alerts.length) throw new Error(alerts.join(' | '))

	const cases_string = group2names.map(i => i).join(',')
	const controls_string = group1names.map(i => i).join(',')
	//group 1 by default is selected as the control group. Later on we can allow user to select which group is control and which is treatment. Reason to do this is to first select the group against which the comparison is to be made in the DE analysis. This is important for the interpretation of the results as analyses is context dependent based on the biological question. If the user wants to compare the expression of a specific gene between 2 groups, then the user should select the group that is not of interest as the control group.
	const expression_input = {
		case: cases_string,
		control: controls_string,
		data_type: 'do_DE',
		input_file: q.file,
		cachedir: serverconfig.cachedir,
		min_count: param.min_count,
		min_total_count: param.min_total_count,
		cpm_cutoff: param.cpm_cutoff,
		storage_type: param.storage_type,
		DE_method: param.method,
		mds_cutoff: 10000 // If the dimensions of the read counts matrix is below this threshold, only then the mds image will be generated as its very compute intensive. Number of genes * Number of samples < mds_cutoff for mds generation
	} as ExpressionInput

	if (param.tw) {
		//console.log("param.tw.q.mode:",param.tw.q.mode)
		expression_input.conf1 = [...conf1_group2, ...conf1_group1] // Make sure the order of the groups is same as in expression_input case and control
		expression_input.conf1_mode = param.tw.q.mode // Parses the type of the confounding variable
		if (new Set(expression_input.conf1).size === 1) {
			// If all elements in the confounding variable are equal, throw error as R script crashes if the confounding variable has only 1 level
			throw new Error('Confounding variable 1 has only one value')
		}
	}

	if (param.tw2) {
		//console.log("param.tw.q.mode:",param.tw.q.mode)
		expression_input.conf2 = [...conf2_group2, ...conf2_group1] // Make sure the order of the groups is same as in expression_input case and control
		expression_input.conf2_mode = param.tw2.q.mode // Parses the type of the confounding variable
		if (new Set(expression_input.conf2).size === 1) {
			// If all elements in the confounding variable are equal, throw error as R script crashes if the confounding variable has only 1 level
			throw new Error('Confounding variable 2 has only one value')
		}
	}

	// The commented out code below helps in printing out the JSON object to a file which can later be passed through the command line to inspect the R/rust code.

	//console.log('expression_input:', expression_input)
	//console.log("param.method:",param.method)
	//fs.writeFile('test.txt', JSON.stringify(expression_input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const sample_size_limit = 8 // Cutoff to determine if parametric estimation using edgeR should be used or non-parametric estimation using wilcoxon test
	if (
		(group1names.length <= sample_size_limit && group2names.length <= sample_size_limit) ||
		param.method == 'edgeR' ||
		param.method == 'limma'
	) {
		// edgeR will be used for DE analysis
		const time1 = new Date().valueOf()
		const result = JSON.parse(await run_R('edge_newh5.R', JSON.stringify(expression_input)))
		mayLog('Time taken to run edgeR:', formatElapsedTime(Date.now() - time1))
		param.method = 'edgeR'
		const ql_imagePath: string = path.join(serverconfig.cachedir, result.edgeR_ql_image_name[0]) // Retrieve the edgeR quality image and send it to client side. Does not need to be an array, will address this later.
		mayLog('ql_imagePath:', ql_imagePath)
		await readFileAndDelete(ql_imagePath, 'ql_image', result)

		if (result.edgeR_mds_image_name) {
			// The R code may not return an mds image file (depending upon mds_cutoff). Query mds image only if it has been generated
			const mds_imagePath: string = path.join(serverconfig.cachedir, result.edgeR_mds_image_name[0]) // Retrieve the edgeR quality image and send it to client side. Does not need to be an array, will address this later.
			mayLog('mds_imagePath:', mds_imagePath)
			await readFileAndDelete(mds_imagePath, 'mds_image', result)
		}

		const images = [result.ql_image]
		if (result.mds_image) images.push(result.mds_image)
		const output: DEResponse = {
			data: result.gene_data,
			sample_size2: result.num_cases[0],
			sample_size1: result.num_controls[0],
			method: param.method,
			images
		}
		if (result.bcv && result.bcv[0] !== null && result.bcv[0] !== undefined) {
			output.bcv = result.bcv[0]
		}
		return output
	}

	// Wilcoxon test will be used for DE analysis
	const time1 = new Date().valueOf()
	const result = JSON.parse(await run_rust('DEanalysis', JSON.stringify(expression_input)))
	mayLog('Time taken to run rust DE pipeline:', formatElapsedTime(Date.now() - time1))
	param.method = 'wilcoxon'
	return { data: result, sample_size1: sample_size1, sample_size2: sample_size2, method: param.method } as DEResponse
}

function validateGroups(sample_size1: number, sample_size2: number, group1names: string[], group2names: string[]) {
	const alerts: string[] = []

	if (sample_size1 < 1) alerts.push('sample size of group1 < 1')
	if (sample_size2 < 1) alerts.push('sample size of group2 < 1')

	const commonnames = group1names.filter(x => group2names.includes(x))
	if (commonnames.length) alerts.push(`Common elements found between both groups: ${commonnames.join(', ')}`)

	return alerts
}

async function readFileAndDelete(file, key, response) {
	const plot = await fs.promises.readFile(file)
	const plotBuffer = Buffer.from(plot).toString('base64')
	const { width, height } = imageSize(file)
	const obj = {
		src: `data:image/png;base64,${plotBuffer}`,
		size: `${width}x${height}`,
		key
	}
	response[key] = obj
	fs.unlink(file, err => {
		if (err) throw new Error(err.message || String(err))
	})
}

export async function validate_query_rnaseqGeneCount(ds) {
	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw new Error('unknown data type for rnaseqGeneCount')
	// the gene count matrix tabular text file
	q.file = path.join(serverconfig.tpmasterdir, q.file)
	/*
    first line of matrix must be sample header, samples start from 5th column for text based files
    read the first line to get all samples, and save at q.allSampleSet
    so that samples from analysis request will be screened against q.allSampleSet
    also require that there's no duplicate samples in header line, so rust/r won't break
    */
	{
		let samples: string[] = []
		if (ds.queries.rnaseqGeneCount.storage_type == 'text') {
			samples = (await get_header_txt(q.file, null)).split('\t').slice(4)
		} else if (ds.queries.rnaseqGeneCount.storage_type == 'HDF5') {
			const get_samples_from_hdf5 = {
				hdf5_file: q.file,
				validate: true
			}
			const time1 = new Date().valueOf()
			const result = await run_rust('readH5', JSON.stringify(get_samples_from_hdf5))
			const time2 = new Date().valueOf()
			mayLog('Time taken to query gene expression:', time2 - time1, 'ms')
			const vr = JSON.parse(result)
			if (vr.status !== 'success') throw new Error(vr.message)
			if (!Array.isArray(vr.samples)) throw new Error('HDF5 file has no samples, please check file.')
			samples = vr.samples
		} else throw new Error('unknown storage type:' + ds.queries.rnaseqGeneCount.storage_type)

		q.allSampleSet = new Set(samples)
		//if(q.allSampleSet.size < samples.length) throw 'rnaseqGeneCount.file header contains duplicate samples'
		const unknownSamples: string[] = []
		for (const n of q.allSampleSet) {
			if (!ds.cohort.termdb.q.sampleName2id(n)) unknownSamples.push(n)
		}
		//if (unknownSamples.length)
		//	throw `${ds.label} rnaseqGeneCount: ${unknownSamples.length} out of ${
		//		q.allSampleSet.size
		//	} sample names are unknown: ${unknownSamples.join(',')}`
		console.log(q.allSampleSet.size, `rnaseqGeneCount samples from ${ds.label}`)
	}
}
