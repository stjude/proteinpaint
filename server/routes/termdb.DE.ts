import fs from 'fs'
import path from 'path'
import type { DERequest, DEResponse, ExpressionInput, RouteApi } from '#types'
import { diffExpPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getData } from '../src/termdb.matrix.js'
import { get_ds_tdb } from '../src/termdb.js'
import run_R from '../src/run_R.js'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '../src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'DEanalysis',
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
			if (!genome) throw 'invalid genome'
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
					ds,
					genome
				)
				if (term_results.error) throw term_results.error
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
					ds,
					genome
				)
				if (term_results2.error) throw term_results2.error
			}

			const results = await run_DE(req.query as DERequest, ds, term_results, term_results2)
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
	if (param.samplelst?.groups?.length != 2) throw '.samplelst.groups.length!=2'
	if (param.samplelst.groups[0].values?.length < 1) throw 'samplelst.groups[0].values.length<1'
	if (param.samplelst.groups[1].values?.length < 1) throw 'samplelst.groups[1].values.length<1'
	// txt file uses string sample name, must convert integer sample id to string
	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw 'unknown data type for rnaseqGeneCount'
	if (!q.storage_type) throw 'storage_type is not defined' // This check is redundant because in ts this is already defined as a mandatory field. Still keeping it as a backup (when storage_type will be permanently switched to HDF5).
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

	if (sample_size1 < 1) throw 'sample size of group1 < 1'
	if (sample_size2 < 1) throw 'sample size of group2 < 1'
	// pass group names and txt file to rust

	const cases_string = group1names.map(i => i).join(',')
	const controls_string = group2names.map(i => i).join(',')
	//group 1 by default is selected as the control group. Later on we can allow user to select which group is control and which is treatment. Reason to do this is to first select the group against which the comparison is to be made in the DE analysis. This is important for the interpretation of the results as analyses is context dependent based on the biological question. If the user wants to compare the expression of a specific gene between 2 groups, then the user should select the group that is not of interest as the control group.
	const expression_input = {
		case: controls_string,
		control: cases_string,
		data_type: 'do_DE',
		input_file: q.file,
		cachedir: serverconfig.cachedir,
		min_count: param.min_count,
		min_total_count: param.min_total_count,
		storage_type: param.storage_type
	} as ExpressionInput

	if (param.tw) {
		//console.log("param.tw.q.mode:",param.tw.q.mode)
		expression_input.conf1 = [...conf1_group2, ...conf1_group1] // Make sure the order of the groups is same as in expression_input case and control
		expression_input.conf1_mode = param.tw.q.mode // Parses the type of the confounding variable
		if (new Set(expression_input.conf1).size === 1) {
			// If all elements in the confounding variable are equal, throw error as R script crashes if the confounding variable has only 1 level
			throw 'Confounding variable 1 has only one value'
		}
	}

	if (param.tw2) {
		//console.log("param.tw.q.mode:",param.tw.q.mode)
		expression_input.conf2 = [...conf2_group2, ...conf2_group1] // Make sure the order of the groups is same as in expression_input case and control
		expression_input.conf2_mode = param.tw2.q.mode // Parses the type of the confounding variable
		if (new Set(expression_input.conf2).size === 1) {
			// If all elements in the confounding variable are equal, throw error as R script crashes if the confounding variable has only 1 level
			throw 'Confounding variable 2 has only one value'
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
	if ((group1names.length <= sample_size_limit && group2names.length <= sample_size_limit) || param.method == 'edgeR') {
		// edgeR will be used for DE analysis
		if (param.method == 'edgeR') {
			expression_input.VarGenes = param.VarGenes // The reason this is behind "param.method == 'edgeR'" is because ranking of variable genes is not needed for low sample size groups.
		}
		const time1 = new Date().valueOf()
		const result = JSON.parse(
			await run_R(path.join(serverconfig.binpath, 'utils', 'edge.R'), JSON.stringify(expression_input))
		)
		mayLog('Time taken to run edgeR:', Date.now() - time1, 'ms')
		param.method = 'edgeR'
		const ql_imagePath: string = path.join(serverconfig.cachedir, result.edgeR_ql_image_name[0]) // Retrieve the edgeR quality image and send it to client side. Does not need to be an array, will address this later.
		mayLog('ql_imagePath:', ql_imagePath)
		const ql_base64Image = await fs
			.readFileSync(ql_imagePath, async (err, data) => {
				if (err) {
					throw ('Error reading image file:', ql_imagePath)
				}
				fs.unlink(imagePath, del_err => {
					// Deleting image file generated by R script, comment out this block (locally) if you want to see the image file externally
					if (del_err) {
						console.error('Error deleting file ' + ql_imagePath + ':', del_err)
					}
				})

				return data
			})
			.toString('base64')

		const mds_imagePath: string = path.join(serverconfig.cachedir, result.edgeR_mds_image_name[0]) // Retrieve the edgeR quality image and send it to client side. Does not need to be an array, will address this later.
		mayLog('mds_imagePath:', mds_imagePath)
		const mds_base64Image = await fs
			.readFileSync(mds_imagePath, async (err, data) => {
				if (err) {
					throw ('Error reading image file:', mds_imagePath)
				}
				fs.unlink(imagePath, del_err => {
					// Deleting image file generated by R script, comment out this block (locally) if you want to see the image file externally
					if (del_err) {
						console.error('Error deleting file ' + mds_imagePath + ':', del_err)
					}
				})

				return data
			})
			.toString('base64')

		return {
			data: result.gene_data,
			sample_size1: sample_size1,
			sample_size2: sample_size2,
			method: param.method,
			ql_image: ql_base64Image,
			mds_image: mds_base64Image
		} as DEResponse
	} else {
		// Wilcoxon test will be used for DE analysis
		const time1 = new Date().valueOf()
		const result = JSON.parse(await run_rust('DEanalysis', JSON.stringify(expression_input)))
		mayLog('Time taken to run rust DE pipeline:', Date.now() - time1, 'ms')
		param.method = 'wilcoxon'
		return { data: result, sample_size1: sample_size1, sample_size2: sample_size2, method: param.method } as DEResponse
	}
}
