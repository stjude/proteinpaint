import * as client from './client'
import * as common from '#shared/common.js'
import { make_ui as AFtest_make_ui } from './block.mds2.vcf.numericaxis.AFtest'
import {
	may_setup_numerical_axis,
	get_axis_label,
	get_axis_label_AFtest,
	may_get_param_AFtest_termfilter
} from './block.mds2.vcf.numericaxis'

/*

********************** EXPORTED
may_create_vcflegend_numericalaxis
********************** INTERNAL
showmenu_numericaxis
__update_legend
*/

export function may_create_vcflegend_numericalaxis(tk, block) {
	/*
run only upon initiating track
*/
	if (!tk.vcf) return
	const nm = tk.vcf.numerical_axis
	if (!nm) return

	const row = tk.legend.table.append('tr')

	// td1
	row.append('td').style('text-align', 'right').style('opacity', 0.3).text('Numerical axis')

	// td2
	const td = row.append('td')
	// contains a table to make sure things are in one row

	const tr = td.append('table').append('tr')

	const menubutton = tr.append('td').append('button').style('margin', '0px 10px')

	// following menubutton, show settings folder

	const settingholder = tr.append('td')

	const update_legend_func = __update_legend(menubutton, settingholder, tk, block)

	update_legend_func()

	menubutton.on('click', () => {
		showmenu_numericaxis(menubutton, tk, block, update_legend_func)
	})
}

function showmenu_numericaxis(menubutton, tk, block, update_legend_func) {
	/* called upon clicking the menubutton
show menu for numerical axis, under menubutton
*/
	tk.legend.tip.clear()
	const menudiv = tk.legend.tip.d

	const nm = tk.vcf.numerical_axis

	if (nm.info_keys) {
		for (const key of nm.info_keys) {
			if (nm.inuse_infokey && key.in_use) {
				// using this info key right now, do not show it in menu
				continue
			}
			let name = key.key
			if (tk.info_fields) {
				const i = tk.info_fields.find(i => i.key == key.key)
				if (i) name = i.label
			}
			menudiv
				.append('div')
				.text(name)
				.attr('class', 'sja_menuoption')
				.on('click', () => {
					// selected an info key
					nm.in_use = true
					nm.inuse_AFtest = false
					nm.inuse_infokey = true
					nm.info_keys.forEach(i => (i.in_use = false))
					key.in_use = true
					update()
				})
		}
	}

	if (nm.AFtest && !nm.inuse_AFtest) {
		// show this option when the data structure is available and is not in use
		menudiv
			.append('div')
			.style('margin-top', '10px')
			.attr('class', 'sja_menuoption')
			.text(get_axis_label_AFtest())
			.on('click', () => {
				nm.in_use = true
				nm.inuse_infokey = false
				nm.inuse_AFtest = true
				/* quick fix!!
				when switching back to AFtest, in any existing is_termdb group, must delete the filterApi
				so the filter UI can re-render, as the UI dom has been deleted
				*/
				if (nm.AFtest && nm.AFtest.groups) {
					for (const g of nm.AFtest.groups) delete g.filterApi
				}
				update()
			})
	}

	if (nm.in_use) {
		// show cancel option
		menudiv
			.append('div')
			.style('margin-top', '10px')
			.attr('class', 'sja_menuoption')
			.html('&times;&nbsp;&nbsp;Disable')
			.on('click', () => {
				nm.in_use = false
				nm.inuse_infokey = false
				nm.inuse_AFtest = false
				update()
			})
	}

	// all contents for the menu created
	tk.legend.tip.showunder(menubutton.node())

	async function update() {
		tk.legend.tip.hide()
		update_legend_func()
		menubutton.node().disabled = true
		await tk.load()
		menubutton.node().disabled = false
	}
}

function __update_legend(menubutton, settingholder, tk, block) {
	/*
returned function to be called at two occasions:
1. at initiating legend options
2. after changing menu option

no need to call this at customizing details for an axis type (AF cutoff, change terms etc)

will update menubutton content,
and settingholder content
but will not update track
*/

	return () => {
		may_setup_numerical_axis(tk)
		menubutton.html(get_axis_label(tk) + ' &#9662;')

		settingholder.selectAll('*').remove()

		const nm = tk.vcf.numerical_axis
		if (!nm.in_use) {
			// not in use
			return
		}

		if (nm.inuse_infokey) {
			// do not show any controls for info field
			return
		}

		if (nm.inuse_AFtest) {
			tk.vcf.numerical_axis.AFtest.dom = { holder: settingholder } // clears .dom, should be fine
			AFtest_make_ui(tk, block)
			return
		}

		throw 'do not know what is in use for numerical axis'
		// exceptions are caught
	}
}
