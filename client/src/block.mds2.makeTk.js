import { select as d3select } from 'd3-selection'
import * as common from '#shared/common.js'
import * as client from './client'
import { init as init_legend } from './block.mds2.legend'
import { may_setup_numerical_axis } from './block.mds2.vcf.numericaxis'
import { loadTk } from './block.mds2'
import { getvcfheader_customtk } from './block.mds2.vcf'
import { interpolateRgb } from 'd3-interpolate'

/*
1. initialize tk object
2. parse client configurations
3. validate
4. initialize legend

********************** EXPORTED
makeTk
********************** INTERNAL
copy_official_configs
parse_client_config
configPanel
may_initiate_vcf
may_initiate_ld
*/

function _load(tk, block) {
	return () => {
		return loadTk(tk, block)
	}
}

export async function makeTk(tk, block) {
	tk.load = _load(tk, block)

	tk.tip2 = new client.Menu({ padding: '0px' })

	if (tk.dslabel) {
		// official dataset

		const ds = block.genome.datasets[tk.dslabel]
		if (!ds) throw 'dataset not found for ' + tk.dslabel

		if (ds.mdsIsUninitiated) {
			const d = await client.dofetch3(`getDataset?genome=${block.genome.name}&dsname=${ds.label}`)
			if (d.error) throw d.error
			if (!d.ds) throw 'ds missing'
			Object.assign(ds, d.ds)
			delete ds.mdsIsUninitiated
		}

		tk.mds = ds
		if (!tk.mds.track) throw 'mds.track{} missing: dataset not configured for mds2 track'

		copy_official_configs(tk)
	} else {
		// custom
		if (!tk.name) tk.name = 'Unnamed'

		if (tk.vcf) {
			await getvcfheader_customtk(tk.vcf, block.genome)
		}
	}

	parse_client_config(tk)

	may_validate_info_fields(tk)

	tk.tklabel.text(tk.name)

	may_initiate_vcf(tk, block)
	may_initiate_ld(tk)

	tk.clear = () => {
		if (tk.g_vcfrow) tk.g_vcfrow.selectAll('*').remove()
		if (tk.leftaxis_vcfrow) tk.leftaxis_vcfrow.selectAll('*').remove()
		if (tk.g_ldrow) tk.g_ldrow.selectAll('*').remove()
		if (tk.gleft_ldrow) tk.gleft_ldrow.selectAll('*').remove()
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
	if (tk.termdb2groupAF) {
		// temp
		if (!tk.mds) throw '.mds missing'
		if (!tk.mds.termdb) throw '.mds.termdb missing'
		// hardcoded for vcf numeric axis
		if (!tk.vcf) throw 'tk.vcf missing'
		if (!tk.vcf.numerical_axis) {
			tk.vcf.numerical_axis = {}
		}
		// this is moved to .numerical_axis{}
		tk.vcf.numerical_axis.termdb2groupAF = tk.termdb2groupAF
		delete tk.termdb2groupAF
		// will be validated in may_setup_numerical_axis
	}
	if (tk.numericaxis_inuse_ebgatest) {
		// temp
		// this may be a convenient way for customizing the numerical axis type on client
		if (!tk.vcf) throw 'tk.vcf missing'
		if (!tk.vcf.numerical_axis) {
			tk.vcf.numerical_axis = {}
		}
		tk.vcf.numerical_axis.inuse_ebgatest = true
		delete tk.vcf.numerical_axis.inuse_infokey
		delete tk.vcf.numerical_axis.inuse_termdb2groupAF
	}
}

function configPanel(tk, block) {}

function may_initiate_vcf(tk, block) {
	if (!tk.vcf) return

	// vcf row
	tk.g_vcfrow = tk.glider.append('g')
	// quick fix to add another layer on top of g_vcfrow
	// both are inside glider so can glide
	tk.g_vcfrow_layer2 = tk.glider.append('g')
	tk.leftaxis_vcfrow = tk.gleft.append('g')

	// quick fix to add label for number of variants for downloading (request from zhaoming)
	// FIXME hardcoded yoffset=15! change if there are multiple labels stacked vertically
	tk.vcfrow_label_numbervariants = block.maketklefthandle(tk, 15).on('click', () => {
		if (!tk.__vcf_data || !tk.__vcf_data.vcf || !tk.__vcf_data.vcf.rglst) return // no data registered
		const variantlst = []
		for (const r of tk.__vcf_data.vcf.rglst) {
			if (!r.variants) continue
			for (const m of r.variants) {
				variantlst.push(m.chr + ':' + (m.pos + 1) + ' ' + m.ref + '>' + m.altstr)
			}
		}
		tk.tktip.showunder(tk.vcfrow_label_numbervariants.node())
		tk.tktip.clear().d.append('textarea').attr('cols', 25).attr('rows', 20).text(variantlst.join('\n'))
	})

	try {
		may_setup_numerical_axis(tk)
	} catch (e) {
		throw 'numerical axis error: ' + e
	}
}

function may_initiate_ld(tk) {
	if (!tk.ld) return
	tk.g_ldrow = tk.glider.append('g')
	tk.gleft_ldrow = tk.gleft.append('g')

	if (tk.g_vcfrow_layer2) {
		/* add a circle for highlighting clicked variant;
		circle is persistent; hidden by default, visible and overlay with clicked variant
		will be resized upon rendering
		*/
		tk.ld.overlay.vcfcircle = tk.g_vcfrow_layer2
			.append('circle')
			.attr('fill', 'none')
			.attr('stroke', 'black')
			.attr('stroke-width', 2)
			.attr('stroke-opacity', 0)
	}
}

function copy_official_configs(tk) {
	/*
for official tk only
requires tk.mds{}
make hard copy of attributes to tk
so multiple instances of the same tk won't cross-react

Note: must keep customizations of official tk through embedding api
*/
	if (!tk.mds) return
	tk.name = tk.mds.track.name

	if (tk.mds.track.vcf) {
		if (!tk.vcf) tk.vcf = {}
		const c = JSON.parse(JSON.stringify(tk.mds.track.vcf)) // a hard copy to be planted to tk.vcf{}
		for (const k in c) {
			if (tk.vcf[k] == undefined) tk.vcf[k] = c[k]
		}
		// preserve customizations of numerical axis
		if (c.numerical_axis) {
			for (const k in c.numerical_axis) {
				if (tk.vcf.numerical_axis[k] == undefined) tk.vcf.numerical_axis[k] = c.numerical_axis[k]
			}
			if (c.numerical_axis.AFtest) {
				for (const k in c.numerical_axis.AFtest) {
					if (tk.vcf.numerical_axis.AFtest[k] == undefined) tk.vcf.numerical_axis.AFtest[k] = c.numerical_axis.AFtest[k]
				}
			}
		}
	}
	if (tk.mds.track.ld) {
		if (!tk.ld) tk.ld = {}
		if (!tk.ld.connheight) tk.ld.connheight = 50
		const c = JSON.parse(JSON.stringify(tk.mds.track.ld))
		for (const k in c) {
			if (tk.ld[k] == undefined) tk.ld[k] = c[k]
		}
		tk.ld.overlay.r2_to_color = interpolateRgb(tk.ld.overlay.color_0, tk.ld.overlay.color_1)
	}

	// TODO other file types

	if (tk.mds.track.info_fields) {
		// TODO accept customizations
		tk.info_fields = JSON.parse(JSON.stringify(tk.mds.track.info_fields))
	}
	if (tk.mds.track.populations) {
		tk.populations = JSON.parse(JSON.stringify(tk.mds.track.populations))
	}
	if (tk.mds.track.sample_termfilter) tk.sample_termfilter = JSON.parse(JSON.stringify(tk.mds.track.sample_termfilter))
}

function may_validate_info_fields(tk) {
	if (!tk.info_fields) return
	if (!Array.isArray(tk.info_fields)) throw 'info_fields should be an array'
	for (const i of tk.info_fields) {
		if (!i.key) throw 'key missing from one of info_fields'
		if (!i.label) i.label = i.key

		if (!i.isfilter) continue

		// for info fields serving as filters

		if (i.iscategorical) {
			if (!i.values) throw '.values[] missing from a categorical info field ' + i.label
			if (!Array.isArray(i.values)) throw '.values[] not an array from info field ' + i.label
			for (const v of i.values) {
				if (!v.key) throw '.key missing from a value of info field ' + i.label
				if (!v.label) v.label = v.key
			}
		} else if (i.isinteger || i.isfloat) {
			if (!i.range) throw '.range{} missing from a numeric info field ' + i.label
		} else if (i.isflag) {
			// no setting
		} else {
			throw 'info field ' + i.label + ' neither numerical or categorical'
		}
	}
}
