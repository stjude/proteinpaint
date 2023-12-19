import fs from 'fs'
import lines2R from './lines2R'
import path from 'path'
import { spawn } from 'child_process'
import { write_file, mayCopyFromCookie, fileurl } from './utils'
import serverconfig from './serverconfig'
import { snvindelByRangeGetter_bcf } from './mds3.init'
import { run_rust } from '@sjcrh/proteinpaint-rust'

/*
method good for somatic variants, in skewer and gp queries:
1) query all data without filtering
2) generate totalcount for variant attr (mclass)
   and class breakdown for sampleSummaries
3) filter by variant/sample attr
4) generate post-filter showcount and hiddencount for variant attr
   and show/hidden class breakdown for sampleSummaries


************************* q{}
.hiddenmclass Set

************************* returned data {}
## if no data, return empty arrays, so that the presence of data.skewer indicate data has been queried

.skewer[]
	ssm, sv, fusion
	has following hardcoded attributes
	.occurrence INT
	.samples [{}]
		.sample_id
.genecnvNosample[]
 */

export function mds3_request_closure(genomes) {
	return async (req, res) => {
		try {
			if (!req.query.genome) throw '.genome missing'
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'

			const q = init_q(req, genome)

			const ds = await get_ds(q, genome)

			may_validate_filters(q, ds)

			const result = await load_driver(q, ds)
			res.send(result)
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

function summarize_mclass(mlst) {
	// should include cnv segment data here
	// ??? if to include genecnv data here?
	const cc = new Map() // k: mclass, v: {}
	for (const m of mlst) {
		// snvindel has m.class=str, svfusion has only dt=int
		const key = m.class || m.dt
		cc.set(key, 1 + (cc.get(key) || 0))
	}
	return [...cc].sort((i, j) => j[1] - i[1])
}

function init_q(req, genome) {
	const query = req.query

	if (req.get('X-Auth-Token')) {
		// user token may be provided from request header, the logic could be specific to gdc or another dataset
		query.token = req.get('X-Auth-Token')
	}

	mayCopyFromCookie(query, req.cookies)

	// cannot validate filter0 here as ds will be required and is not made yet
	if (query.hiddenmclasslst) {
		query.hiddenmclass = new Set(query.hiddenmclasslst.split(','))
		delete query.hiddenmclasslst
		// this filter set is passed to actual data querying method, after class is set for each item, will check it to decide if to drop
	}
	return query
}

function finalize_result(q, ds, result) {
	const sampleSet = new Set() // collects sample ids if present in data points

	if (result.skewer) {
		for (const m of result.skewer) {
			if (m.samples) {
				m.occurrence = m.samples.length

				mayAddSkewerRimCount(m, q, ds)
				mayAddFormatSampleCount(m, ds)

				for (const s of m.samples) {
					sampleSet.add(s.sample_id)
				}
				delete m.samples
			}
		}
	}

	if (sampleSet.size) {
		// has samples, report total number of unique samples across all data types
		result.sampleTotalNumber = sampleSet.size
	}
}

function mayAddSkewerRimCount(m, q, ds) {
	if (!q.skewerRim) return // not using rim
	// using rim; rim reflects number of samples, out of all harboring this variant, with a common attribute
	if (q.skewerRim.type == 'format') {
		m.rim1count = 0
		for (const s of m.samples) {
			if (s.formatK2v?.[q.skewerRim.formatKey] == q.skewerRim.rim1value) {
				m.rim1count++
			}
		}
		return
	}
	throw 'unknown skewerRim.type'
}

function mayAddFormatSampleCount(m, ds) {
	if (!ds.queries.snvindel?.format) return
	for (const formatKey in ds.queries.snvindel.format) {
		if (!ds.queries.snvindel.format[formatKey].isFilter) continue // this field is not filterable
		// has a filterable field

		// generates formatK2count{} at m-level, to gather sample counts and return to client for legend display
		if (!m.formatK2count) m.formatK2count = {}
		if (!m.formatK2count[formatKey]) m.formatK2count[formatKey] = { v2c: {}, unannotatedCount: 0 }
		for (const s of m.samples) {
			const v = s.formatK2v?.[formatKey]
			if (v == undefined) {
				m.formatK2count[formatKey].unannotatedCount++
			} else {
				m.formatK2count[formatKey].v2c[v] = 1 + (m.formatK2count[formatKey].v2c[v] || 0)
			}
		}
	}
}

async function get_ds(q, genome) {
	if (q.dslabel) {
		// is official dataset
		if (!genome.datasets) throw '.datasets{} missing from genome'
		const ds = genome.datasets[q.dslabel]
		if (!ds) throw 'invalid dslabel'
		return ds
	}
	// for a custom dataset, a temporary ds{} obj is made for every query, based on q{}
	// may cache index files from url, thus the await
	const ds = { queries: {} }
	if (q.bcffile || q.bcfurl) {
		const [e, file, isurl] = fileurl({ query: { file: q.bcffile, url: q.bcfurl } })
		if (e) throw e
		const _tk = {}
		if (isurl) {
			_tk.url = file
			_tk.indexURL = q.bcfindexURL
		} else {
			_tk.file = file
		}
		ds.queries.snvindel = { byrange: { _tk } }
		ds.queries.snvindel.byrange.get = await snvindelByRangeGetter_bcf(ds, genome)
	}
	// add new file types

	return ds
}

async function load_driver(q, ds) {
	// various bits of data to be appended as keys to result{}
	// what other loaders can be if not in ds.queries?

	if (q.singleSampleGenomeQuantification) {
		if (!ds.queries.singleSampleGenomeQuantification) throw 'not supported on this dataset'
		const p = ds.queries.singleSampleGenomeQuantification[q.singleSampleGenomeQuantification.dataType]
		if (!p) throw 'invalid dataType'
		return await p.get(q.singleSampleGenomeQuantification.sample, q.devicePixelRatio)
	}
	if (q.singleSampleGbtk) {
		if (!ds.queries.singleSampleGbtk) throw 'not supported on this dataset'
		const p = ds.queries.singleSampleGbtk[q.singleSampleGbtk.dataType]
		if (!p) throw 'invalid dataType'
		return await p.get(q.singleSampleGbtk.sample)
	}

	if (q.ssm2canonicalisoform) {
		// gdc-specific logic
		if (!ds.ssm2canonicalisoform) throw 'ssm2canonicalisoform not supported on this dataset'
		return { isoform: await ds.ssm2canonicalisoform.get(q) }
	}

	if (q.variant2samples) {
		if (!ds.variant2samples) throw 'not supported by server'
		const out = await ds.variant2samples.get(q)
		return { variant2samples: out }
	}

	if (q.m2csq) {
		if (ds.queries && ds.queries.snvindel && ds.queries.snvindel.m2csq) {
			return { csq: await ds.queries.snvindel.m2csq.get(q) }
		}
		throw 'm2csq not supported on this dataset'
	}

	if (q.forTrack) {
		// to load things for block track
		const result = {}

		if (q.skewer) {
			// get skewer data
			result.skewer = [] // for skewer track

			if (ds.queries.snvindel) {
				// the query will resolve to list of mutations, to be flattened and pushed to .skewer[]
				const mlst = await query_snvindel(q, ds)
				/* mlst=[], each element:
				{
					ssm_id:str
					mclass
					samples:[ {sample_id}, ... ]
				}
				*/
				result.skewer.push(...mlst)
			}

			if (ds.queries.svfusion) {
				// todo
				const d = await query_svfusion(q, ds)
				result.skewer.push(...d)
			}

			if (ds.queries.geneCnv) {
				// just a test; can allow gene-level cnv to be indicated as leftlabel
				// can disable this step if not to show it in skewer tk
				// trouble is that it's using case id as event.samples[].sample_id
				// compared to ssm where it is sample id for m.samples[].sample_id
				const lst = await query_geneCnv(q, ds)
				// this is not appended to result.skewer[]
				result.geneCnv = lst
			}

			filter_data(q, result)

			result.mclass2variantcount = summarize_mclass(result.skewer)
		}

		// add queries for new data types

		finalize_result(q, ds, result)
		return result
	}

	if (q.geneExpression) {
		if (!ds.queries.geneExpression) throw 'not supported'
		const { gene2sample2value, byTermId, sampleNameMap } = await ds.queries.geneExpression.get(q)
		/*
		sampleNameMap{} is optional mapping
		for gdc, it maps uuid to submitter; uuid is used in gene2sample2value
		*/
		if (gene2sample2value.size == 0) throw 'no data'
		if (gene2sample2value.size == 1) {
			// get data for only 1 gene; may create violin plot
			return { gene2sample2value }
		}

		// have data for multiple genes, run clustering
		const t = new Date()
		const clustering = await geneExpressionClustering(gene2sample2value, q, ds)
		if (serverconfig.debugmode) console.log('clustering done:', new Date() - t, 'ms')
		return { clustering, byTermId, sampleNameMap }
	}

	// other query type

	throw 'do not know what client wants'
}

async function query_snvindel(q, ds) {
	if (q.isoform) {
		// client supplies isoform, see if isoform query is supported
		if (q.atgenomic) {
			// in genomic mode
			if (!ds.queries.snvindel.byrange) throw '.atgenomic but missing byrange query method'
			return await ds.queries.snvindel.byrange.get(q)
		}
		if (ds.queries.snvindel.byisoform) {
			// querying by isoform is supported
			return await ds.queries.snvindel.byisoform.get(q)
		} else {
			// querying by isoform is not supported, continue to check if can query by range
		}
	}
	// not querying by isoform;
	if (q.rglst) {
		// provided range parameter
		if (!ds.queries.snvindel.byrange) throw 'q.rglst[] provided but .byrange{} is missing'

		return await ds.queries.snvindel.byrange.get(q)
	}
	// may allow other query method (e.g. by gene name from a db table)
	throw 'insufficient query parameters for snvindel'
}

async function query_svfusion(q, ds) {
	if (q.rglst) {
		if (!ds.queries.svfusion.byrange) throw 'q.rglst provided but svfusion.byrange missing'
		return await ds.queries.svfusion.byrange.get(q)
	}
	throw 'insufficient query parameters for svfusion'
}
async function query_geneCnv(q, ds) {
	if (q.gene) {
		if (!ds.queries.geneCnv.bygene) throw 'q.gene provided but geneCnv.bygene missing'
		return await ds.queries.geneCnv.bygene.get(q)
	}

	// do not throw here, so not to disable range query
	//throw 'insufficient query parameters for geneCnv'
}

// not in use
async function query_genecnv(q, ds) {
	if (q.isoform) {
		if (ds.queries.genecnv.byisoform) {
			let name = q.isoform
			if (ds.queries.genecnv.byisoform.sqlquery_isoform2gene) {
				// convert isoform to gene name
				const tmp = ds.queries.genecnv.byisoform.sqlquery_isoform2gene.query.get(q.isoform)
				if (tmp && tmp.gene) {
					name = tmp.gene
				} else {
					console.log('no gene found by ' + q.isoform)
					// do not crash the query! return no data
					return
				}
			}
			return await ds.queries.genecnv.byisoform.get(q, name)
		}
		throw '.byisoform missing for genecnv query'
	}
}

function filter_data(q, result) {
	// will not be needed when filters are combined into graphql query language
	if (result.skewer) {
		const newskewer = []

		for (const m of result.skewer) {
			if (q.rglst) {
				/* when rglst[{chr/start/stop}] is given, filter skewer data points to only keep those in view range
				this is to address an issue that zooming in when gmmode=protein, tk shows "No samples"
				client has changed that will always issue request when zooming in on same isoform
				server will re-request data, though inefficient
				so as to calculate the number of samples with mutations in zoomed in region of protein
				*/
				if (!q.rglst.find(r => m.chr == r.chr && m.pos >= r.start && m.pos <= r.stop)) {
					// not in any region
					continue
				}
			}

			// filter by other variant attributes

			newskewer.push(m)
		}

		result.skewer = newskewer
	}

	if (result.genecnvAtsample) {
	}
	// other sample-level data types that need filtering
}

/* may validate q.filter0
the validation function is defined in ds
cannot do it in init_q() as ds is not available
this ensures filter0 and its validation is generic and not specific to gdc
*/
function may_validate_filters(q, ds) {
	if (q.filter0) {
		const f =
			typeof q.filter0 == 'object'
				? q.filter0
				: JSON.parse(
						typeof q.filter0 == 'string' && q.filter0.startsWith('%') ? decodeURIComponent(q.filter0) : q.filter0
				  )
		q.filter0 = ds.validate_filter0(f)
	}
	if (q.filterObj && typeof q.filterObj == 'string') {
		q.filterObj = JSON.parse(
			typeof q.filterObj == 'string' && q.filterObj.startsWith('%') ? decodeURIComponent(q.filterObj) : q.filterObj
		)
	}
	if (q.skewerRim) {
		if (q.skewerRim.type == 'format') {
			if (!q.skewerRim.formatKey) throw 'skewerRim.formatKey missing when type=format'
			if (!ds.queries?.snvindel?.format) throw 'snvindel.format{} not found when type=format'
			if (!ds.queries.snvindel.format[q.skewerRim.formatKey]) throw 'invalid skewerRim.formatKey'
		} else {
			throw 'unknown skewerRim.type'
		}
		q.skewerRim.hiddenvalues = new Set()
		if (q.skewerRim.hiddenvaluelst) {
			if (!Array.isArray(q.skewerRim.hiddenvaluelst)) throw 'query.skewerRim.hiddenvaluelst is not array'
			for (const n of q.skewerRim.hiddenvaluelst) q.skewerRim.hiddenvalues.add(n)
			delete q.skewerRim.hiddenvaluelst
		}
	}
	if (q.formatFilter) {
		if (typeof q.formatFilter != 'object') throw 'formatFilter{} not object'
		if (!ds.queries?.snvindel?.format) throw 'snvindel.format{} not found when formatFilter is used'
		const f2 = {} // change list of format values to set
		for (const k in q.formatFilter) {
			if (!ds.queries.snvindel.format[k]) throw 'invalid format key from formatFilter'
			if (!Array.isArray(q.formatFilter[k])) throw 'formatFilter[k] value is not array'
			f2[k] = new Set(q.formatFilter[k])
		}
		q.formatFilter = f2
	}

	// if format field is used for any purpose, set flag addFormatValues=true to retrieve format values on samples
	// by default format values are not returned to increase efficiency
	if (q.skewerRim?.type == 'format' || q.formatFilter) {
		q.addFormatValues = true
	}
}

async function geneExpressionClustering(data, q, ds) {
	// get set of uniq sample names, to generate col_names dimension
	const sampleSet = new Set()
	for (const o of data.values()) {
		// {sampleId: value}
		for (const s in o) sampleSet.add(s)
	}

	const inputData = {
		matrix: [],
		row_names: [], // genes
		col_names: [...sampleSet], // samples
		cluster_method: q.clusterMethod,
		plot_image: false // When true causes cluster.rs to plot the image into a png file (EXPERIMENTAL)
	}

	if (ds.queries.geneExpression.valueIsTransformed) inputData.valueIsTransformed = true // to not to do scale() in R

	// compose "data{}" into a matrix
	//console.log('data:', data)
	for (const [gene, o] of data) {
		inputData.row_names.push(gene)
		const row = []
		for (const s of inputData.col_names) {
			row.push(o[s] || 0)
		}
		inputData.matrix.push(row)
	}

	/*
        // For testing
        inputData.row_names.push("fakegene")
        const row = []
        for (const s of inputData.col_names) {
           row.push(0)
        }
        inputData.matrix.push(row)
        */

	//console.log('inputData.matrix:', inputData.matrix.length, inputData.matrix[0].length)
	//console.log('input_data:', inputData)
	//await write_file('test.json', JSON.stringify(inputData))

	const Rinputfile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	await write_file(Rinputfile, JSON.stringify(inputData))
	const Routput = JSON.parse(await lines2R(path.join(serverconfig.binpath, 'utils/hclust.R'), [], [Rinputfile]))
	fs.unlink(Rinputfile, () => {})

	let row_coordinates = []
	for (const item of JSON.parse(Routput['RowNodeJson'])) {
		row_coordinates.push({ x: item[0].x[0], y: item[1].y[0] })
	}
	let col_coordinates = []
	for (const item of JSON.parse(Routput['ColNodeJson'])) {
		col_coordinates.push({ x: item[0].x[0], y: item[1].y[0] })
	}
	let matrix_1d = []
	//console.log(Routput['OutputMatrix'])
	for (const item of Routput['OutputMatrix']) {
		matrix_1d.push(item['elem'][0])
	}
	let row_names_index = []
	let col_names_index = []

	for (const item of Routput['RowDendOrder']) {
		row_names_index.push(item['i'][0])
	}
	for (const item of Routput['ColumnDendOrder']) {
		col_names_index.push(item['i'][0])
	}

	let row_names = []
	let col_names = []

	for (const item of Routput['SortedRowNames']) {
		row_names.push(item['gene'][0])
	}
	for (const item of Routput['SortedColumnNames']) {
		col_names.push(item['sample'][0])
	}

	let row_output = await parseclust(row_coordinates, row_names_index)
	let col_output = await parseclust(col_coordinates, col_names_index)

	// Converting the 1D array to 2D array column-wise
	let output_matrix = []
	for (let i = 0; i < row_names.length; i++) {
		if (col_names.length > 0) {
			let row = []
			for (let j = 0; j < col_names.length; j++) {
				row.push(matrix_1d[j * row_names.length + i])
			}
			output_matrix.push(row)
		}
	}

	//console.log('output_matrix:', output_matrix)
	//console.log('row_dendro:', row_output.dendrogram)
	//console.log('row_children:', row_output.children)
	//console.log('row_names_index:', JSON.stringify(row_names_index))
	//console.log('col_dendro:', col_output.dendrogram)
	//console.log('col_children:', col_output.children)
	//console.log('col_names_index:', JSON.stringify(col_names_index))

	/* rust is no longer used

	const rust_output = await run_rust('cluster', JSON.stringify(inputData))
	//console.log('result:', result)

        sorted_sample_elements: List of indices of samples in sorted matrix
        sorted_gene_elements: List of indices of genes in sorted matrix
        sorted_gene_coordinates: Information for each node in the sample dendrogram (see details in rust/src/cluster.rs)
        sorted_sample_coordinates: Information for each node in the gene dendrogram (see details in rust/src/cluster.rs)
	let colSteps, rowSteps
	const rust_output_list = rust_output.split('\n')
	for (let item of rust_output_list) {
		if (item.includes('colSteps')) {
			colSteps = JSON.parse(JSON.parse(item.replace('colSteps:', '')))
		} else if (item.includes('rowSteps')) {
			rowSteps = JSON.parse(JSON.parse(item.replace('rowSteps:', '')))
		}
	}
	//console.log('colSteps:', colSteps)
	//console.log('rowSteps:', rowSteps)
	*/

	return {
		geneNameLst: row_names,
		sampleNameLst: col_names,
		matrix: output_matrix,
		row_dendro: row_output.dendrogram,
		row_children: row_output.children,
		row_names_index: row_names_index,
		col_dendro: col_output.dendrogram,
		col_children: col_output.children,
		col_names_index: col_names_index
	}
}

async function parseclust(coordinates, names_index) {
	// This function parses the output from fastclust.R output. The dendextend packages prints the x-y coordinates for each node in depth-first search format. So the order of x-y coordinates describes how each nodes is connected to ane another.

	/*

        |         (1.75, 69.749)  
        |     ____._____
        |     |        |(2.5,65.0797)           
        |     |     ___.___             
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |_____._____._____.__
             (1,0)  (2,0) (3,0) 

        R dendextend output for the above dendrogram is as follows (depth-first search format)
             [,1]     [,2]
        [1,] 1.75 69.74910
        [2,] 1.00  0.00000
        [3,] 2.50 65.07977
        [4,] 2.00  0.00000
        [5,] 3.00  0.00000

        Output is in depth-first search format


        */

	let first = 1
	let xs = []
	let ys = []
	for (const item of coordinates) {
		//console.log(item)
		if (Number(item.x) % 1 != 0 && Number(item.y == 0)) {
			// In rare cases sometimes y=0 when x is decimal (not integer). This is happening most probably because the y-value is infinitesimally small so y is set to 0.0001 to approximate it.
			xs.push(Number(item.x))
			ys.push(0.0001)
		} else {
			xs.push(Number(item.x))
			ys.push(Number(item.y))
		}
	}
	//console.log(xs)
	//console.log(ys)

	let depth_start_position = 0 // Initializing position of depth start to position 0 in R output
	let i = 0
	let depth_first_branch = []
	let prev_ys = []
	let prev_xs = []
	let break_point = false
	let old_depth_start_position = 0
	let node_children = []
	let leaf_counter = 0
	for (let i = 0; i < ys.length; i++) {
		//console.log('i:', i)
		if (break_point == true) {
			// This clause is invoked when the a node's y-coordinate is found to be higher than the previous one (break_point = true). Then all previous nodes are searched for the closest node that is higher than the current node. This determines where the new branch should start from. In above example line 3 will be parsed (after break_point is set to true in previous iteration) since the y-coordinate of the node is higher than the node described in the previous line
			let hit = 0
			//console.log('prev_ys:', prev_ys)
			for (let j = 0; j < prev_ys.length; j++) {
				let k = prev_ys.length - j - 1
				//console.log('prev_ys[k]:', prev_ys[k])
				//console.log('ys[i]:', ys[i])
				if (prev_ys[k] > ys[i]) {
					depth_first_branch.push({ id1: i, x1: xs[i], y1: ys[i], id2: k, x2: prev_xs[k], y2: prev_ys[k] })
					hit = 1
					//console.log('Found')
					break
				}
			}
			if (hit == 0) {
				// Should not happen
				console.log('No suitable branch point found')
			}
			depth_first_branch.push({ id1: i, x1: xs[i], y1: ys[i], id2: i + 1, x2: xs[i + 1], y2: ys[i + 1] })
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
			//prev_ys = []
			//prev_xs = []
			//old_depth_start_position = depth_start_position
			break_point = false
		} else if (ys[i] > ys[i + 1] && i <= ys.length - 1) {
			// When y-coordinate of current node is greater than that of the next node, the current branch is extended to the next node. In case of line 2 and 4 in example output is parsed using this if clause statement.
			depth_first_branch.push({ id1: i, x1: xs[i], y1: ys[i], id2: i + 1, x2: xs[i + 1], y2: ys[i + 1] })
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
		} else if (ys[i] == ys[i + 1] && i <= ys.length - 1) {
			// When y-coordinate of current node is equal to that of the next node, it suggests both nodes are leaf nodes. IN that case the branch is extended from the previous node to the next node. Line 5 (in example output) will be parsed using this if clause.
			depth_first_branch.push({ id1: i - 1, x1: xs[i - 1], y1: ys[i - 1], id2: i + 1, x2: xs[i + 1], y2: ys[i + 1] })
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
		} else if (i == ys.length - 1) {
			// When the current node is the last element it is checked if it is a leaf node (it should be)
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
		} else {
			// When y-coordinate of next node is greater than that of the current node. The current branch ends and break_point is set to true. In the next iteration of the loop it is decided where the new branch should start from. Line 3 (in example) will be parsed using this clause.
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
			//old_depth_first_branch = depth_first_branch
			//depth_first_branch = []
			break_point = true
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}

			//depth_start_position = i // Start of new branch
		}
	}
	//console.log('node_children:', node_children)
	return { dendrogram: depth_first_branch, children: node_children }
	//console.log(depth_first_branch)
}

async function update_leaf_node(depth_first_branch, given_node, node_children, node_id) {
	//console.log('given_node:', given_node)
	let current_node = given_node // Initialize the current node to the given_node
	let node_result = node_children.find(i => i.id == current_node) // Search if the node is already been entered in node_children
	if (node_result) {
		// If already present add current node to its children field
		let node_index = node_children.findIndex(i => i.id == current_node)
		node_children[node_index].children.push(node_id)
	} else {
		// If not present create an object with id = current_node and in children intitialize children array with node_id
		node_children.push({ id: current_node, children: [node_id] })
	}

	// Find branch of current node
	while (current_node != 0) {
		// Top node. This loop will continue until top node is reached
		let node_connector1 = depth_first_branch.find(i => i.id1 == current_node) // Find id1 with current_node
		let current_node1
		let current_node2
		if (node_connector1) {
			if (node_connector1.y1 <= node_connector1.y2) {
				// If y-coordinate of id1 is less than that of id2 then current_node1 = id2

				//console.log('depth_first_branch:', depth_first_branch)
				//console.log('current_node:', current_node)
				//console.log('node_connector1:', node_connector1)
				current_node1 = node_connector1.id2
			}
		}

		let node_connector2 = depth_first_branch.find(i => i.id2 == current_node) // Find id2 with current_node
		if (node_connector2) {
			if (node_connector2.y1 >= node_connector2.y2) {
				// If y-coordinate of id2 is less than that of id1 then current_node2 = id1

				//console.log('depth_first_branch:', depth_first_branch)
				//console.log('current_node:', current_node)
				//console.log('node_connector2:', node_connector2)
				current_node2 = node_connector2.id1
			}
		}

		if (!node_connector1 && node_connector2) {
			current_node = current_node2
		} else if (node_connector1 && !node_connector2) {
			current_node = current_node1
		} else if (node_connector1 && node_connector2) {
			if (node_connector1.y2 > node_connector2.y1) {
				current_node = current_node1
			} else {
				current_node = current_node2
			}
		} else {
			// Should not happen
			console.log('No connections found!')
		}

		// Adding node_id to current_node

		let node_result = node_children.find(i => i.id == current_node) // Search if the node is already been entered in node_children
		//console.log('node_result:', node_result)
		//console.log('given_node2:', given_node)
		if (node_result) {
			// If already present add current node to its children field
			let node_index = node_children.findIndex(i => i.id == current_node)
			node_children[node_index].children.push(node_id)
		} else {
			// If not present create an object with id = current_node and in children intitialize children array with node_id
			node_children.push({ id: current_node, children: [node_id] })
		}
		//console.log('node_children:', node_children)
	}
	return node_children
}
