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
*/

const labyspace = 5

export async function makeTk(tk, block) {
	tk.load = _load(tk, block)

	tk.tip2 = new client.Menu({ padding: '0px' })

	if (tk.dslabel) {
		// official dataset

		tk.mds = block.genome.datasets[tk.dslabel]
		if (!tk.mds) throw 'dataset not found for ' + tk.dslabel

		copy_official_configs(tk)
	} else {
		// custom
		if (!tk.name) tk.name = 'Unamed'
		tk.mds = {}
		// to fill in details to tk.mds
		/*
		if (tk.vcf) {
			await getvcfheader_customtk(tk.vcf, block.genome)
		}
		*/
	}

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
