import fs from 'fs'
import path from 'path'
import readline from 'readline'
import * as d3scale from 'd3-scale'
import * as d3color from 'd3-color'
import * as utils from './utils.js'
import serverconfig from './serverconfig.js'
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
slice_file_add_color() // add color (decimal) to each dot by auto or custom categorical color
getCustomCatColor() // get custom color if defined in json
getCustomCatOrder() // if legend order is defined in the json

gene expression (tabix-indexed exp file) is no longer supported, including
getpcd.gene_expression for overlay, getgeneboxplot for violin, and getheatmap

TODO need to test the existence of the json file
*/

export function handle_singlecell_closure(genomes) {
	return async (req, res) => {
		try {
			const q = req.query
			const gn = genomes[q.genome]
			if (!gn) throw 'invalid genome'

			// dispatch on presence, so that an invalid value such as null is answered by the validation below
			if (q.getpcd !== undefined) {
				await get_pcd(q, res)
				return
			}
			throw 'unknown request'
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

	// check parameter types before reading the file
	if (!q.getpcd || typeof q.getpcd != 'object') throw 'getpcd must be an object'
	const xyz = q.getpcd.coord
	if (!Array.isArray(xyz) || (xyz.length != 2 && xyz.length != 3) || !xyz.every(isColumnIndex))
		throw 'getpcd.coord must be an array of 2 or 3 column indices'
	checkDelimiter(q.delimiter)
	const background_color = q.background_color ? parseColor(q.background_color, 'background_color') : 16777215 //white color
	const cat_values =
		q.getpcd.category_customcolor || q.getpcd.category_customorder ? checkCatValues(q.getpcd.cat_values) : undefined

	// hidden_types is a request parameter and may be tampered with, so only accept an array of strings
	if (q.hidden_types !== undefined && !Array.isArray(q.hidden_types)) throw 'hidden_types must be an array'
	const hidden_types = new Set((q.hidden_types || []).filter(t => typeof t == 'string'))

	// set up coloring scheme
	let categorical_color_function
	let collect_category2color
	let collect_category_count
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
		categorical_color_function = getCustomCatColor(cat_values, auto_color_fn)
		collect_category2color = {}
		collect_category_count = {}
	}

	if (categorical_color_function && !isColumnIndex(q.getpcd.category_index))
		throw 'getpcd.category_index must be a column index'

	const lines = []
	let firstline = true
	// get max and min from all 3 coordinates and to get radius of point cloud
	let maxcord = 0,
		mincord = 0

	// errors from the file stream or the callback are reported by the route's catch
	await forEachLine(q.textfile, line => {
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
			if (hidden_types.has(ca)) {
				newl.push(background_color)
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
		}

		lines.push(newl.join(' '))
	})

	if (collect_category2color) {
		// if legend order is defined in the config, add that to return to client
		if (q.getpcd.category_customorder) {
			collect_category2color = getCustomCatOrder(collect_category2color, cat_values)
		}
		result.category2color = collect_category2color
		result.categorycount = collect_category_count
	}

	// get abs of min and max to get radius of point cloud
	result.data_sphere_r = Math.max(Math.abs(maxcord), Math.abs(mincord))
	return lines
}

/*
read a text file under tpmasterdir line by line; errors from the file stream
or thrown by the callback reject the returned promise
*/
async function forEachLine(file, callback) {
	const base = path.resolve(serverconfig.tpmasterdir)
	const full = path.resolve(file)
	// the file path must stay inside tpmasterdir
	if (!full.startsWith(base + path.sep)) throw 'file must be under tpmasterdir'
	if (!(await fs.promises.stat(full)).isFile()) throw 'not a file: ' + path.relative(base, full)
	const input = fs.createReadStream(full)
	const rl = readline.createInterface({ input, crlfDelay: Infinity })
	try {
		for await (const line of rl) callback(line)
	} finally {
		rl.close()
		input.destroy()
	}
}

function isColumnIndex(i) {
	return Number.isInteger(i) && i >= 0
}

function checkDelimiter(d) {
	if (typeof d != 'string' || !d || d.length > 10) throw 'delimiter must be a short string'
}

// returns the color as a '#rrggbb' string
function toHexColor(color, key) {
	const c = typeof color == 'string' ? d3color.rgb(color) : null
	if (!c || !Number.isFinite(c.r) || !Number.isFinite(c.g) || !Number.isFinite(c.b)) throw `invalid ${key}`
	return c.formatHex()
}

// returns the color as a decimal integer
function parseColor(color, key) {
	return Number.parseInt(toHexColor(color, key).slice(1), 16)
}

// returns a copy of cat_values with each defined color as '#rrggbb'
function checkCatValues(catValues) {
	if (!Array.isArray(catValues)) throw 'getpcd.cat_values must be an array'
	return catValues.map(v => {
		if (!v || typeof v != 'object') throw 'getpcd.cat_values must be an array of objects'
		return v.color === undefined ? v : { ...v, color: toHexColor(v.color, 'getpcd.cat_values color') }
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
