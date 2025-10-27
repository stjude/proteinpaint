import fs from 'fs'
import readline from 'readline'
import * as d3scale from 'd3-scale'
import * as d3color from 'd3-color'
import * as d3interpolate from 'd3-interpolate'
import * as utils from './utils.js'
import { schemeCategory10 } from 'd3-scale-chromatic'

const schemeCategory20 = [
	'#1f77b4',
	'#aec7e8',
	'#ff7f0e',
	'#ffbb78',
	'#2ca02c',
	'#98df8a',
	'#d62728',
	'#ff9896',
	'#9467bd',
	'#c5b0d5',
	'#8c564b',
	'#c49c94',
	'#e377c2',
	'#f7b6d2',
	'#7f7f7f',
	'#c7c7c7',
	'#bcbd22',
	'#dbdb8d',
	'#17becf',
	'#9edae5'
]

/*
********************** EXPORTED
handle_singlecell_closure()
********************** INTERNAL
get_pcd() // reformat UMAP data into PCD 
slice_file_add_color() // add color (decimal) to each dot by auto, custom categorical color or expression
getCustomCatColor() // get custom color if defined in json
getCustomCatOrder() // if legend order is defined in the json
rgbToHex() // convert rgb to hex
get_geneboxplot() // also get kernel density for violin plot
get_histogram()
get_heatmap() // get heatmap data for group of genes
cellfile_get_barcode2category() // k: barcode, v: {category, expvalue}

TODO need to test the existence of the json file
*/

export function handle_singlecell_closure(genomes) {
	return async (req, res) => {
		try {
			const q = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'

			if (q.getpcd) {
				await get_pcd(q, res)
				return
			}
			if (q.getgeneboxplot) {
				await get_geneboxplot(q, gn, res)
				return
			}
			if (q.getheatmap) {
				await get_heatmap(q, gn, res)
				return
			}
		} catch (e) {
			res.send({ error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function get_pcd(q, res) {
	/* hardcoded to 3d
		TODO 2d, svg
		PCD file format guide: https://pcl.readthedocs.io/projects/tutorials/en/latest/pcd_file_format.html
	*/

	const result = {}

	const lines = await slice_file_add_color(q, result)

	const header = `# .PCD v.7 - Point Cloud Data file format
VERSION .7
FIELDS x y z rgb
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH 1200
HEIGHT 800
VIEWPOINT 0 0 0 1 0 0 0
POINTS 960000
DATA ascii
`

	result.pcddata = header + lines.join('\n')
	res.send(result)
}

async function slice_file_add_color(q, result) {
	/*
to slice the csv/tab file of all cells
for each cell, assign color based on desired method
return pcd format data
may attach coloring scheme to result{} for returning to client
*/

	if (!q.textfile) throw '.textfile missing'
	{
		const [e, file, isurl] = utils.fileurl({ query: { file: q.textfile } })
		if (e) throw '.textfile error: ' + e

		if (!isurl) {
			if (await utils.file_not_exist(file)) throw 'file not exist: ' + q.textfile
			if (await utils.file_not_readable(file)) throw 'file not readable: ' + q.textfile
		}

		q.textfile = file
	}

	// set up coloring scheme
	let categorical_color_function
	let cell2color_byexp // color by gene expression values
	let collect_category2color
	let collect_category_count
	let collect_gene_expression2color
	// if color scheme is automatic, collect colors here for returning to client

	if (q.getpcd.category_autocolor) {
		// using a category with automatic color
		const auto_color_scale = q.getpcd.values_count && q.getpcd.values_count <= 10 ? schemeCategory10 : schemeCategory20
		categorical_color_function = d3scale.scaleOrdinal(auto_color_scale)
		collect_category2color = {}
		collect_category_count = {}
		// k: category, v: color
	} else if (q.getpcd.category_customcolor) {
		const auto_color_fn = d3scale.scaleOrdinal(schemeCategory20)
		categorical_color_function = getCustomCatColor(q.getpcd.cat_values, auto_color_fn)
		collect_category2color = {}
		collect_category_count = {}
		collect_gene_expression2color = {}
	} else if (q.getpcd.gene_expression) {
		const ge = q.getpcd.gene_expression
		if (!ge.file) throw 'gene_expression.file missing'
		{
			const [e, file, isurl] = utils.fileurl({ query: { file: ge.file } })
			if (e) throw e
			ge.file = file
		}
		if (!Number.isInteger(ge.barcodecolumnidx)) throw 'gene_expression.barcodecolumnidx missing'
		if (!ge.chr) throw 'gene_expression.chr missing'
		if (!ge.start) throw 'gene_expression.start missing'
		if (!ge.stop) throw 'gene_expression.stop missing'
		if (!ge.genename) throw 'gene_expression.genename missing'
		if (ge.autoscale) {
			if (!ge.color_min) throw 'gene_expression.color_min missing at autoscale'
			if (!ge.color_max) throw 'gene_expression.color_max missing at autoscale'
		} else {
			throw 'gene_expression: unknown scaling method'
		}

		const coord = (ge.nochr ? ge.chr.replace('chr', '') : ge.chr) + ':' + ge.start + '-' + ge.stop
		const cell2value = new Map()
		cell2color_byexp = new Map()

		let minexpvalue = 0,
			maxexpvalue = 0

		// collect number of cells
		result.numbercellwithgeneexp = 0
		result.numbercelltotal = 0

		await utils.get_lines_bigfile({
			args: [ge.file, coord],
			callback: line => {
				const j = JSON.parse(line.split('\t')[3])
				if (j.gene != ge.genename) return
				if (!Number.isFinite(j.value)) return
				result.numbercellwithgeneexp++

				if (ge.autoscale) {
					minexpvalue = Math.min(minexpvalue, j.value)
					maxexpvalue = Math.max(maxexpvalue, j.value)
				}

				cell2value.set(j.sample, j.value)
			}
		})

		// record scaling to return to client
		if (ge.autoscale) {
			result.minexpvalue = minexpvalue
			result.maxexpvalue = maxexpvalue
			const interpolate = d3interpolate.interpolateRgb(ge.color_min, ge.color_max)
			for (const [k, v] of cell2value) {
				const c = d3color.color(interpolate((v - minexpvalue) / (maxexpvalue - minexpvalue)))

				cell2color_byexp.set(k, Number.parseInt(rgbToHex(c.r, c.g, c.b), 16))
			}
		}
	}

	return new Promise((resolve, reject) => {
		const lines = []
		const rl = readline.createInterface({ input: fs.createReadStream(q.textfile) })
		let firstline = true
		// get max and min from all 3 coordinates and to get radius of point cloud
		let maxcord = 0,
			mincord = 0

		rl.on('line', line => {
			if (firstline) {
				firstline = false
				return
			}

			const l = line.split(q.delimiter)

			const newl = []

			for (const i of q.getpcd.coord) {
				newl.push(l[i])
				maxcord = Math.max(maxcord, l[i])
				mincord = Math.min(mincord, l[i])
			}

			if (q.getpcd.coord.length == 2) {
				newl.push('0')
			}

			if (categorical_color_function) {
				const ca = l[q.getpcd.category_index]
				const co = categorical_color_function(ca)
				if (q.hidden_types.includes(ca)) {
					if (q.background_color) {
						const c = d3color.color(q.background_color)
						const color = Number.parseInt(rgbToHex(c.r, c.g, c.b), 16)
						newl.push(color)
					} else newl.push(16777215) //white color
				} else {
					newl.push(Number.parseInt(co.slice(1), 16))
				}
				if (collect_category2color) {
					collect_category2color[ca] = co
				}
				if (collect_category_count) {
					if (ca in collect_category_count) {
						collect_category_count[ca] = collect_category_count[ca] + 1
					} else {
						collect_category_count[ca] = 1
					}
				}
			} else if (cell2color_byexp) {
				result.numbercelltotal++

				const barcode = l[q.getpcd.gene_expression.barcodecolumnidx]
				let color = cell2color_byexp.get(barcode)
				// if(!color) return

				// add color for cells without expression to retain cluster shape
				// if color_min is black, then it will be converted to 00000, and will reassing, so check for type rahter than !color
				if (typeof color == 'undefined') {
					if (q.getpcd.gene_expression.color_no_exp) {
						const c = d3color.color(q.getpcd.gene_expression.color_no_exp)
						color = Number.parseInt(rgbToHex(c.r, c.g, c.b), 16)
					} else {
						color = '2894892' // dark grey
						//color = '14540253' //light grey
					}
				}
				newl.push(color)
			}

			lines.push(newl.join(' '))
		})
		rl.on('close', () => {
			if (collect_category2color) {
				// if legend order is defined in the config, add that to return to client
				if (q.getpcd.category_customorder) {
					collect_category2color = getCustomCatOrder(collect_category2color, q.getpcd.cat_values)
				}
				result.category2color = collect_category2color
				result.categorycount = collect_category_count
			}

			// get abs of min and max to get radius of point cloud
			result.data_sphere_r = Math.max(Math.abs(maxcord), Math.abs(mincord))
			resolve(lines)
		})
	})
}

function getCustomCatColor(catValues, auto_color) {
	return cat => {
		let color_defined = false
		for (const c of catValues) {
			if (c.value == cat) {
				color_defined = true
				return c.color
			}
		}
		//if color is not defined in config file, assingn auto color from d3 color
		if (!color_defined) return auto_color(cat)
	}
}

function getCustomCatOrder(category2color, catValues) {
	let new_cat2col = {}
	const cat_len = Object.keys(category2color).length

	// Add values in new vat2col in order
	for (var i = 1; i <= cat_len; i++) {
		const found = catValues.find(v => {
			if (v.order == i) return v.value
		})
		if (found) new_cat2col[found.value] = category2color[found.value]
	}

	// Add values which doesn't have order defined in config file
	for (const v of catValues) {
		if (!v.order) new_cat2col[v.value] = category2color[v.value]
	}

	// Add values which are not defined in config file
	for (const key in category2color) {
		// let found = false
		const found = catValues.find(v => {
			if (v.value == JSON.stringify(key)) return true
		})
		if (!found) new_cat2col[key] = category2color[key]
	}
	return new_cat2col
}

function componentToHex(c) {
	const hex = c.toString(16)
	return hex.length == 1 ? '0' + hex : hex
}

function rgbToHex(r, g, b) {
	return componentToHex(r) + componentToHex(g) + componentToHex(b)
}

async function get_geneboxplot(q, gn, res) {
	// also get kernel density for violin plot

	const ge = q.getgeneboxplot
	const categorical_color_function =
		q.getgeneboxplot.values_count && q.getgeneboxplot.values_count <= 10
			? d3scale.scaleOrdinal(schemeCategory10)
			: d3scale.scaleOrdinal(schemeCategory20)

	if (!ge.expfile) throw 'getgeneboxplot.expfile missing'
	{
		const [e, file, isurl] = utils.fileurl({ query: { file: ge.expfile } })
		if (e) throw 'getgeneboxplot.expfile error: ' + e
		ge.expfile = file
	}
	if (!ge.chr) throw 'getgeneboxplot.chr missing'
	if (!ge.start) throw 'getgeneboxplot.start missing'
	if (!ge.stop) throw 'getgeneboxplot.stop missing'
	if (!ge.genename) throw 'getgeneboxplot.genename missing'

	const barcode2catvalue = await cellfile_get_barcode2category(ge)
	// k: barcode, v: {category, expvalue}

	const coord = (ge.nochr ? ge.chr.replace('chr', '') : ge.chr) + ':' + ge.start + '-' + ge.stop

	let minexpvalue = 0,
		maxexpvalue = 0

	await utils.get_lines_bigfile({
		args: [ge.expfile, coord],
		callback: line => {
			const j = JSON.parse(line.split('\t')[3])
			if (j.gene != ge.genename) return
			if (!j.sample) return
			if (!Number.isFinite(j.value)) return

			const c = barcode2catvalue.get(j.sample)
			if (!c) return
			c.expvalue = j.value

			minexpvalue = Math.min(minexpvalue, j.value)
			maxexpvalue = Math.max(maxexpvalue, j.value)
		}
	})

	const category2values = new Map()
	// k: category, v: array of exp values, from all cells of that category

	// divide cells to categories
	for (const [barcode, v] of barcode2catvalue) {
		if (!category2values.has(v.category)) category2values.set(v.category, [])
		if (ge.exclude_cells && parseInt(v.expvalue) == 0) continue
		category2values.get(v.category).push({ value: v.expvalue })
	}

	const boxplots_ = []
	// each element is one category

	const scaleticks = d3scale.scaleLinear().domain([minexpvalue, maxexpvalue]).ticks(20)

	// kde doesn't work -- using the wrong kernel??
	//const kde = kernelDensityEstimator( kernelEpanechnikov(7), scaleticks )

	const histofunc = get_histogram(scaleticks)

	for (const [category, values] of category2values) {
		values.sort((i, j) => i.value - j.value)

		const b = utils.boxplot_getvalue(values)
		delete b.out // remove outliers
		const co = categorical_color_function(category)

		b.category = category
		b.color = co

		b.numberofcells = values.length // now is just the total number of cells

		//b.density =  kde( values.map( i=> i.value ) )
		b.density = histofunc(values)

		boxplots_.push(b)
	}

	let boxplots = []
	if (q.getgeneboxplot.cat_values) {
		const cat_len = Object.keys(q.getgeneboxplot.cat_values).length

		// Add values in new vat2col in order
		for (var i = 1; i <= cat_len; i++) {
			const found = q.getgeneboxplot.cat_values.find(v => {
				if (v.order == i) return v.value
			})
			if (found) boxplots.push(boxplots_.filter(bx => bx.category == found.value)[0])
		}

		// // Add values which doesn't have order defined in config file
		for (const v of q.getgeneboxplot.cat_values) {
			if (!v.order) boxplots.push(boxplots_.filter(bx => bx.category == v.value)[0])
		}

		// // Add values which are not defined in config file
		for (const bx of boxplots_) {
			const found = q.getgeneboxplot.cat_values.find(v => {
				if (v.value == bx['category']) return true
			})
			if (!found) boxplots.push(bx)
		}

		for (const bx of boxplots) {
			const found = q.getgeneboxplot.cat_values.find(v => {
				if (v.value == bx['category']) return v
			})
			if (found && found.color) bx.color = found.color
		}
	} else boxplots = boxplots_

	res.send({ boxplots, minexpvalue, maxexpvalue })
}

function get_histogram(ticks) {
	return values => {
		// array of {value}
		const bins = []
		for (let i = 1; i < ticks.length; i++) bins.push(0)
		for (const v of values) {
			for (let i = 1; i < ticks.length; i++) {
				if (v.value <= ticks[i]) {
					bins[i - 1]++
					break
				}
			}
		}
		return bins
	}
}

async function get_heatmap(q, gn, res) {
	const ge = q.getheatmap
	const gene_heatmap = [] //for each gene, new array will be created with each catagory

	if (!ge.expfile) throw 'getgeneboxplot.expfile missing'
	{
		const [e, file, isurl] = utils.fileurl({ query: { file: ge.expfile } })
		if (e) throw 'getgeneboxplot.expfile error: ' + e
		ge.expfile = file
	}
	ge.gene_list.forEach(gene => {
		if (!gene.chr) throw 'getgeneboxplot.chr missing'
		if (!gene.start) throw 'getgeneboxplot.start missing'
		if (!gene.stop) throw 'getgeneboxplot.stop missing'
		if (!gene.gene) throw 'getgeneboxplot.genename missing'
	})

	const barcode2catvalue = await cellfile_get_barcode2category(ge)

	for (const gene of ge.gene_list) {
		const coord = (gene.nochr ? gene.chr.replace('chr', '') : gene.chr) + ':' + gene.start + '-' + gene.stop

		let minexpvalue = 0,
			maxexpvalue = 0

		const genename = gene.gene

		await utils.get_lines_bigfile({
			args: [ge.expfile, coord],
			callback: line => {
				const j = JSON.parse(line.split('\t')[3])
				if (j.gene.toUpperCase() !== gene.gene.toUpperCase()) return
				if (!j.sample) return
				if (!Number.isFinite(j.value)) return

				const c = barcode2catvalue.get(j.sample)
				if (!c) return
				c.expvalue = j.value

				minexpvalue = Math.min(minexpvalue, j.value)
				maxexpvalue = Math.max(maxexpvalue, j.value)
			}
		})

		const category2values = new Map()
		// k: category, v: array of exp values, from all cells of that category

		// divide cells to categories
		for (const [barcode, v] of barcode2catvalue) {
			if (!category2values.has(v.category)) category2values.set(v.category, [])
			category2values.get(v.category).push({ value: v.expvalue })
		}

		const heatmap = []
		// each element is one category

		for (const [category, values] of category2values) {
			// values.sort((i,j)=> i.value-j.value )
			let total = 0
			for (const v of values) {
				total += v.value
			}

			const numberofcells = values.length

			const mean = (total / numberofcells).toFixed(3)

			heatmap.push({ category, mean, numberofcells })
		}
		// const heatmap_data = {boxplots, maxexpvalue, minexpvalue}
		gene_heatmap.push({ genename, heatmap })
	}
	res.send({ gene_heatmap })
}

function cellfile_get_barcode2category(p) {
	/*
.cellfile
.barcodecolumnidx
.categorycolumnidx
.delimiter

returns map, note the value is an object!!
k: barcode
v: { category, expvalue }
*/
	if (!p.cellfile) throw 'cellfile missing'
	{
		const [e, file, isurl] = utils.fileurl({ query: { file: p.cellfile } })
		if (e) throw 'cellfile error: ' + e
		p.cellfile = file
	}
	if (!p.delimiter) throw 'delimiter missing'
	if (!Number.isInteger(p.barcodecolumnidx)) throw 'barcodecolumnidx missing'
	if (!Number.isInteger(p.categorycolumnidx)) throw 'categorycolumnidx missing'

	return new Promise((resolve, reject) => {
		const barcode2category = new Map()

		const rl = readline.createInterface({ input: fs.createReadStream(p.cellfile) })
		let first = true
		rl.on('line', line => {
			if (first) {
				first = false
				return
			}
			const l = line.split(p.delimiter)
			//barcode2category.set( l[ p.barcodecolumnidx ], l[ p.categorycolumnidx ] )
			barcode2category.set(l[p.barcodecolumnidx], {
				category: l[p.categorycolumnidx],
				expvalue: 0 // FIXME hardcoded baseline value (e.g. the gene is not expressed in this sample)
			})
		})
		rl.on('close', () => {
			resolve(barcode2category)
		})
	})
}
