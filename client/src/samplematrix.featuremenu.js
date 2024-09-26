import * as client from './client'
import * as common from '#shared/common.js'

export function showMenu_isgenevalue(smat, f) {
	smat.menu.d
		.append('div')
		.attr('class', 'sja_menuoption')
		.text('Sort')
		.on('click', () => {
			smat.menu.hide()
			if (f.sort) {
				// already sorting with smat one
				return
			}
			// sort with smat one
			for (const f2 of smat.features) {
				if (f2.isgenevalue) delete f2.sort
			}
			f.sort = 1
			smat.draw_matrix()
		})
}

export function showMenu_iscnv(smat, f, obj) {
	/*
	if reuse it for ismutation, obj should be f.cnv
	if iscnv can also use f.cnv, then no need to bother with it
	*/

	// log2ratio cutoff
	{
		const row = smat.menu.d.append('div').style('margin', '10px')
		row.append('span').html('CNV log2(ratio) cutoff&nbsp;')
		row
			.append('input')
			.property('value', obj.valuecutoff || 0)
			.attr('type', 'number')
			.style('width', '50px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = Number.parseFloat(event.target.value)
				if (!v || v < 0) {
					// invalid value, set to 0 to cancel
					v = 0
				}
				if (v == 0) {
					if (obj.valuecutoff) {
						// cutoff has been set, cancel and refetch data
						obj.valuecutoff = 0
						smat.update_singlefeature(f)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (obj.valuecutoff) {
					// cutoff has been set
					if (obj.valuecutoff == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						obj.valuecutoff = v
						smat.update_singlefeature(f)
					}
				} else {
					// cutoff has not been set
					obj.valuecutoff = v
					smat.update_singlefeature(f)
				}
			})
		row
			.append('div')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
			.html('Only show CNV with absolute log2(ratio) no less than cutoff.<br>Set to 0 to cancel.')
	}

	// focal cnv
	{
		const row = smat.menu.d.append('div').style('margin', '10px')
		row.append('span').html('CNV segment size limit&nbsp;')
		row
			.append('input')
			.property('value', obj.focalsizelimit || 0)
			.attr('type', 'number')
			.style('width', '100px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = Number.parseInt(event.target.value)
				if (!v || v < 0) {
					// invalid value, set to 0 to cancel
					v = 0
				}
				if (v == 0) {
					if (obj.focalsizelimit) {
						// cutoff has been set, cancel and refetch data
						obj.focalsizelimit = 0
						smat.update_singlefeature(f)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (obj.focalsizelimit) {
					// cutoff has been set
					if (obj.focalsizelimit == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						obj.focalsizelimit = v
						smat.update_singlefeature(f)
					}
				} else {
					// cutoff has not been set
					obj.focalsizelimit = v
					smat.update_singlefeature(f)
				}
			})
		row.append('span').text('bp')
		row
			.append('div')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
			.html('Limit the CNV segment length to show only focal events.<br>Set to 0 to cancel.')
	}
}

export function showMenu_isloh(smat, f, obj) {
	// segmean cutoff
	{
		const row = smat.menu.d.append('div').style('margin', '10px')
		row.append('span').html('LOH segmean cutoff&nbsp;')
		row
			.append('input')
			.property('value', obj.valuecutoff || 0)
			.attr('type', 'number')
			.style('width', '50px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = Number.parseFloat(event.target.value)
				if (!v || v < 0) {
					// invalid value, set to 0 to cancel
					v = 0
				}
				if (v == 0) {
					if (obj.valuecutoff) {
						// cutoff has been set, cancel and refetch data
						obj.valuecutoff = 0
						smat.update_singlefeature(f)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (obj.valuecutoff) {
					// cutoff has been set
					if (obj.valuecutoff == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						obj.valuecutoff = v
						smat.update_singlefeature(f)
					}
				} else {
					// cutoff has not been set
					obj.valuecutoff = v
					smat.update_singlefeature(f)
				}
			})
		row
			.append('div')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
			.html('Only show LOH with segmean no less than cutoff.<br>Set to 0 to cancel.')
	}

	// focal cnv
	{
		const row = smat.menu.d.append('div').style('margin', '10px')
		row.append('span').html('LOH segment size limit&nbsp;')
		row
			.append('input')
			.property('value', obj.focalsizelimit || 0)
			.attr('type', 'number')
			.style('width', '100px')
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				let v = Number.parseInt(event.target.value)
				if (!v || v < 0) {
					// invalid value, set to 0 to cancel
					v = 0
				}
				if (v == 0) {
					if (obj.focalsizelimit) {
						// cutoff has been set, cancel and refetch data
						obj.focalsizelimit = 0
						smat.update_singlefeature(f)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if (obj.focalsizelimit) {
					// cutoff has been set
					if (obj.focalsizelimit == v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						obj.focalsizelimit = v
						smat.update_singlefeature(f)
					}
				} else {
					// cutoff has not been set
					obj.focalsizelimit = v
					smat.update_singlefeature(f)
				}
			})
		row.append('span').text('bp')
		row
			.append('div')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
			.html('Limit the LOH segment length to show only focal events.<br>Set to 0 to cancel.')
	}
}

export function showMenu_ismutation(smat, f) {
	/*
	 */

	{
		// show/hide mutation classes

		const div = smat.menu.d.append('div').style('margin', '10px').style('border', 'solid 1px #ededed')

		const update = () => {
			smat.update_singlefeature(f)
			smat.menu.hide()
		}

		const table = div.append('table').style('margin', '10px').style('border-spacing', '1px')

		const tbody = table.append('tbody')

		{
			// cnv
			const tr = tbody.append('tr')
			tr.append('td').style('opacity', 0.5).text('CNV')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(f.cnv.hidden ? 'Show' : 'Hide')
				.on('click', () => {
					f.cnv.hidden = !f.cnv.hidden
					update()
				})
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text('Show only')
				.on('click', () => {
					ismutation_hideallclass(f)
					delete f.cnv.hidden
					update()
				})
			const td = tr.append('td')
			if (!f.cnv.hidden) {
				td.attr('class', 'sja_menuoption')
					.style('font-size', '.8em')
					.text('CONFIG')
					.on('click', () => {
						smat.menu.clear()
						showMenu_iscnv(smat, f, f.cnv)
					})
			}
		}
		{
			// loh
			const tr = tbody.append('tr')
			tr.append('td').style('opacity', 0.5).text('LOH')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(f.loh.hidden ? 'Show' : 'Hide')
				.on('click', () => {
					f.loh.hidden = !f.loh.hidden
					update()
				})
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text('Show only')
				.on('click', () => {
					ismutation_hideallclass(f)
					delete f.loh.hidden
					update()
				})
			const td = tr.append('td')
			if (!f.loh.hidden) {
				td.attr('class', 'sja_menuoption')
					.style('font-size', '.8em')
					.text('CONFIG')
					.on('click', () => {
						smat.menu.clear()
						showMenu_isloh(smat, f, f.loh)
					})
			}
		}
		{
			// itd
			const tr = tbody.append('tr')
			tr.append('td').style('opacity', 0.5).text('ITD')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(f.itd.hidden ? 'Show' : 'Hide')
				.on('click', () => {
					f.itd.hidden = !f.itd.hidden
					update()
				})
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text('Show only')
				.on('click', () => {
					ismutation_hideallclass(f)
					delete f.itd.hidden
					update()
				})
			const td = tr.append('td')
			if (!f.itd.hidden) {
				// no config yet for itd
			}
		}
		{
			// sv
			const tr = tbody.append('tr')
			tr.append('td').style('opacity', 0.5).text('SV')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(f.sv.hidden ? 'Show' : 'Hide')
				.on('click', () => {
					f.sv.hidden = !f.sv.hidden
					update()
				})
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text('Show only')
				.on('click', () => {
					ismutation_hideallclass(f)
					delete f.sv.hidden
					update()
				})
			const td = tr.append('td')
			if (!f.sv.hidden) {
				// no config yet for sv
			}
		}
		{
			// fusion
			const tr = tbody.append('tr')
			tr.append('td').style('opacity', 0.5).text('Fusion')
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(f.fusion.hidden ? 'show' : 'hide')
				.on('click', () => {
					f.fusion.hidden = !f.fusion.hidden
					update()
				})
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text('show only')
				.on('click', () => {
					ismutation_hideallclass(f)
					delete f.fusion.hidden
					update()
				})
			const td = tr.append('td')
			if (!f.fusion.hidden) {
				// no config yet for fusion
			}
		}

		table
			.append('tbody')
			.append('tr')
			.append('td')
			.attr('colspan', 4)
			.style('padding-top', '10px')
			.append('span')
			.style('font-size', '.8em')
			.text('List SNV/indel')
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				if (tbody2.style('display') == 'none') {
					tbody2.style('display', 'table-row-group')
				} else {
					tbody2.style('display', 'none')
				}
			})

		const tbody2 = table.append('tbody').style('display', 'none')

		// each mclass
		for (const k in common.mclass) {
			const c = common.mclass[k]
			if (c.dt != common.dtsnvindel) {
				// only show snvindel classes
				continue
			}
			const tr = tbody2.append('tr')
			tr.append('td').style('opacity', 0.5).text(c.label)
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text(f.snvindel.excludeclasses[k] ? 'Show' : 'Hide')
				.on('click', () => {
					if (f.snvindel.excludeclasses[k]) {
						delete f.snvindel.excludeclasses[k]
					} else {
						f.snvindel.excludeclasses[k] = 1
					}
					update()
				})
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.text('Show only')
				.on('click', () => {
					ismutation_hideallclass(f)
					delete f.snvindel.excludeclasses[k]
					update()
				})
			const td = tr.append('td')
		}

		div
			.append('div')
			.style('margin', '10px')
			.append('span')
			.style('font-size', '.8em')
			.text('Show all classes')
			.attr('class', 'sja_clbtext')
			.on('click', () => {
				f.cnv.hidden = false
				f.loh.hidden = false
				f.itd.hidden = false
				f.sv.hidden = false
				f.fusion.hidden = false
				f.snvindel.excludeclasses = {}
				update()
			})

		// end of show/hide class
	}
}

function ismutation_hideallclass(f) {
	f.cnv.hidden = true
	f.loh.hidden = true
	f.itd.hidden = true
	f.sv.hidden = true
	f.fusion.hidden = true
	f.snvindel.excludeclasses = {}
	for (const k in common.mclass) {
		if (common.mclass[k].dt == common.dtsnvindel) f.snvindel.excludeclasses[k] = 1
	}
}
