import { dofetch3 } from '#common/dofetch'
import { makeTk } from './makeTk'
import { renderTk } from './render'
import { rangequery_rglst } from '../mds3/tk'
//import { make_leftlabels } from './leftlabel'

/*
export type Tk = {
	dslabel:string
	termdbConfig: any
	vocabApi: any
	maxReadCount: number
	/ in flight list of junctions, with rendering x/y coordinates 
	data?: Junction[]
}
export type Junction = {
	chr: string
	start: number
	stop: number
	strand: string
	sampleCount: number
	medianReadCount: number
	sv?: object
	x0?: number
	x1?: number
	x?: number
	_x?: number
	axisy?: number
}
*/

export async function loadTk(tk, block) {
	block.tkcloakon(tk)
	block.block_setheight()

	try {
		if (tk.uninitialized) {
			await makeTk(tk, block)
			delete tk.uninitialized
		}

		const data = await getTkData(tk, block)

		// render each possible track type. if indeed rendered, return sub track height

		// left labels and skewer at same row, whichever taller
		renderTk(data, tk, block)

		// must render tk first, then left labels
		//await make_leftlabels(data, tk, block)

		// done tk rendering, adjust height
		tk._finish(data)
	} catch (e) {
		if (tk.clear) tk.clear() // if the error is thrown upon initiating the track, clear() function may not have been added
		if (tk._finish) tk._finish({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}

function getParameter(tk, block) {
	// to get data for current view range

	const par = {
		genome: block.genome.name,
		dslabel: tk.dslabel,
		filter0: tk.filter0,
		filter: tk.filter
	}

	const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }

	rangequery_rglst(tk, block, par)

	{
		const lst = []
		if (tk.legend?.type?.hiddenvalues?.size) for (const c of tk.legend.type.hiddenvalues) lst.push(c)
		if (lst.length) par.hiddenTypes = lst
	}

	return [par, headers]
}

/*
abstract various data sources

returned data{}:

.skewer[]
	list of data points to show as skewer plot
.mclass2variantcount[]
	mclass breakdown of skewer[]
*/
async function getTkData(tk, block) {
	let data
	if (tk.custom_data) {
		// has custom data on client side, no need to request from server
		data = await dataFromCustomData(tk, block)
	} else {
		// request data from server, either official or custom sources
		const [body, headers] = getParameter(tk, block)
		data = await dofetch3('termdb/junctions', { body, headers })
	}
	if (data.error) throw new Error(data.error)
	return data
}

async function dataFromCustomData(tk, block) {
	const data = []
	// todo
	return data
}
