import { select as d3select, event as d3event } from 'd3-selection'
import * as common from '../common'
import * as client from '../client'
import { init as init_legend } from './legend'
import { loadTk } from './tk'

/*
common structure of tk.mds between official and custom

tk.skewer{}
	create if skewer data type is available for this mds
	if not equipped then tk.skewer is undefined and should not show skewer track

stratify labels will account for all tracks, e.g. skewer, cnv
*/

const labyspace = 5

export async function makeTk(tk, block) {
	tk.load = _load(tk, block)

	tk.tip2 = new client.Menu({ padding: '0px' })

	get_ds(tk, block)

	// tk.mds is created for both official and custom track
	// following procedures are only based on tk.mds
	if (tk.mds.has_skewer) {
		tk.skewer = {
			g: tk.glider.append('g')
		}
	}

	tk.tklabel.text(tk.mds.label)

	let laby = labyspace + block.labelfontsize
	tk.label_mcount = block.maketklefthandle(tk, laby)
	laby += labyspace + block.labelfontsize

	tk.clear = () => {
		// where is it used
	}

	// TODO <g> for other file types

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		configPanel(tk, block)
	})

	init_legend(tk, block)
}

function get_ds(tk, block) {
	if (tk.dslabel) {
		// official dataset

		tk.mds = block.genome.datasets[tk.dslabel]
		if (!tk.mds) throw 'dataset not found for ' + tk.dslabel

		copy_official_configs(tk)
		if (tk.mds.variant2samples && !tk.mds.variant2samples.get) {
			tk.mds.variant2samples.get = async mlst => {
				/*
				support alternative methods
				where all data are hosted on client
				*/
				// hardcode to getsummary and using fixed levels
				const par = [
					'genome=' + block.genome.name,
					'dslabel=' + tk.mds.label,
					'variant2samples=1',
					'levels=' + JSON.stringify(tk.mds.variant2samples.levels),
					'getsummary=1'
				]
				if (tk.mds.variant2samples.variantkey == 'ssm_id') {
					par.push('ssm_id_lst=' + mlst.map(i => i.ssm_id).join(','))
				} else {
					throw 'unknown variantkey for variant2samples'
				}
				return await client.dofetch2('mds3?' + par.join('&'))
			}
		}
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

function parse_client_config(tk) {
	/* for both official and custom
configurations and their location are not stable
*/
}

function configPanel(tk, block) {}

function copy_official_configs(tk) {
	/*
for official tk only
requires tk.mds{}
make hard copy of attributes to tk
so multiple instances of the same tk won't cross-react

Note: must keep customizations of official tk through embedding api
*/
	tk.name = tk.mds.name
}

function _load(tk, block) {
	return () => {
		return loadTk(tk, block)
	}
}
