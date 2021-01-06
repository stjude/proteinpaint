import { select as d3select, event as d3event } from 'd3-selection'
import * as client from '../client'
import { init as init_legend } from './legend'
import { loadTk } from './tk'

/*
TODO how to tell if tk.mds is a custom track

common structure of tk.mds between official and custom

tk.skewer{}
	create if skewer data type is available for this mds
	if not equipped then tk.skewer is undefined and should not show skewer track

stratify labels will account for all tracks, e.g. skewer, cnv
*/

export async function makeTk(tk, block) {
	tk.load = _load(tk, block) // shorthand

	tk.itemtip = new client.Menu()

	tk.samplefiltertemp = {}
	// switch to .samplefilter with a filter.js object

	get_ds(tk, block)
	// tk.mds is created for both official and custom track
	// following procedures are only based on tk.mds

	init_termdb(tk, block)

	init_mclass(tk)

	mayaddGetter_variant2samples(tk, block)

	if (tk.mds.has_skewer) {
		tk.skewer = {
			g: tk.glider.append('g')
		}
	}

	tk.tklabel.text(tk.mds.label)

	tk.leftlabelg = tk.gleft.append('g')

	tk.clear = () => {
		// called in loadTk, when uninitialized is true
		if (tk.skewer) tk.skewer.g.selectAll('*').remove()
	}

	// TODO <g> for other file types

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	init_legend(tk, block)
}

function init_mclass(tk) {
	// hidden mclass is controled on the client side
	tk.hiddenmclass = new Set()
	if (tk.mds.hiddenmclass) {
		// port over default hidden mclass
		for (const c of tk.mds.hiddenmclass) tk.hiddenmclass.add(c)
	}
	// #variant for mclass returned by server
	tk.mclass2variantcount = new Map()
}

function get_ds(tk, block) {
	if (tk.dslabel) {
		// official dataset

		tk.mds = block.genome.datasets[tk.dslabel]
		if (!tk.mds) throw 'dataset not found for ' + tk.dslabel

		return
	}
	// custom
	if (!tk.name) tk.name = 'Unamed'
	tk.mds = {}
	// to fill in details to tk.mds
	/*
	if (tk.vcf) {
		await getvcfheader_customtk(tk.vcf, block.genome)
	}
	*/
	// if variant2samples is enabled for custom ds, it will also have the async get()
}

function init_termdb(tk, block) {
	const tdb = tk.mds.termdb
	if (!tdb) return
	tdb.getTermById = id => {
		if (tdb.terms) return tdb.terms.find(i => i.id == id)
		return null
	}
}

function mayaddGetter_variant2samples(tk, block) {
	if (!tk.mds.variant2samples) return
	if (tk.mds.variant2samples.get) return // track from the same mds has already been intialized
	// native track, need to know what to do for custom track
	tk.mds.variant2samples.get = async (tk0, mlst, querytype) => {
		/*
		TODO support alternative data sources
		where all data are hosted on client
		*/
		// hardcode to getsummary and using fixed levels
		const par = [
			'genome=' + block.genome.name,
			'dslabel=' + tk.mds.label,
			'variant2samples=1',
			'get=' + querytype,
			'samplefiltertemp=' + JSON.stringify(tk0.samplefiltertemp) // must use tk0 but not tk for this one
		]
		if (tk.mds.variant2samples.variantkey == 'ssm_id') {
			// TODO detect too long string length that will result url-too-long error
			// in such case, need alternative query method
			par.push('ssm_id_lst=' + mlst.map(i => i.ssm_id).join(','))
		} else {
			throw 'unknown variantkey for variant2samples'
		}
		if (tk.set_id) par.push('set_id=' + tk.set_id)
		if (tk.token) par.push('token=' + tk.token)
		if (tk.filter0) par.push('filter0=' + encodeURIComponent(JSON.stringify(tk.filter0)))
		const data = await client.dofetch2('mds3?' + par.join('&'))
		if (data.error) throw data.error
		if (!data.variant2samples) throw 'result error'
		return data.variant2samples
	}
}

function parse_client_config(tk) {
	/* for both official and custom
configurations and their location are not stable
*/
}

function configPanel(tk, block) {}

function _load(tk, block) {
	return async () => {
		return await loadTk(tk, block)
	}
}
