import { event as d3event } from 'd3-selection'
import * as client from './client'
import { make_select_btn_pair } from '../dom/buttonPair'
import { filterInit, filterJoin, getFilterItemByTag } from '../filter/filter'
import { may_setup_numerical_axis, may_get_param_AFtest_termfilter } from './block.mds2.vcf.numericaxis'
import { appInit } from '../termdb/app'

/*

af{}
.dom{}
	.holder
.groups[]





********************** EXPORTED
make_ui
AFtest_groupname
********************** INTERNAL
show_group
	show_group_termdb
	show_group_infofield
	show_group_population
make_option_testmethod
make_option_termfilter
updatesetting_bygroupselection
menu_editgroup
*/

// hardcoded colors

export function make_ui(tk, block) {
	/*
make ui for AFtest in legend
attaches doms to af.dom{}, and group.dom{}
setting conflicts are resolved after doms are made
*/
	const af = tk.vcf.numerical_axis.AFtest

	const table = af.dom.holder
		.append('table') // 3 columns
		.style('border-spacing', '5px')
		.style('border-collapse', 'separate')
		.style('border-left', 'solid 1px #ccc')

	// one row for each group
	for (const [i, group] of af.groups.entries()) {
		group.dom = {}
		const tr = table.append('tr')
		group.dom.td1 = tr
			.append('td')
			.append('div')
			.attr('class', 'sja_filter_tag_btn')
			.text('GROUP ' + (i + 1))
			.style('white-space', 'nowrap')
			.style('border-radius', '6px')
			.style('background-color', '#ddd')
			.style('color', '#000')
			.style('padding', '6px')
			.style('margin', '3px 5px')
			.style('font-size', '.7em')
			.on('click', () => {
				menu_editgroup(tk, block, group)
			})

		group.dom.td2 = tr
			.append('td')
			.style('opacity', 0.5)
			.style('font-size', '.8em')
			.style('white-space', 'nowrap')
		group.dom.td3 = tr.append('td')

		show_group(tk, block, group)
	}

	make_option_testmethod(af, tk, block, table)
	make_option_termfilter(af, tk, block, table)

	updatesetting_bygroupselection(tk)
}

function make_option_testmethod(af, tk, block, table) {
	// make legend row for test method <select>
	const tr = table.append('tr')
	const td = tr.append('td').attr('colspan', 3)
	td.append('span')
		.text('TEST METHOD')
		.style('padding', '6px')
		.style('margin', '3px 5px')
		.style('font-size', '.7em')
	af.dom.testmethod_select = td.append('select').on('change', () => {
		af.testby_AFdiff = false
		af.testby_fisher = false
		const i = af.dom.testmethod_select.node().selectedIndex
		if (i == 0) {
			af.testby_AFdiff = true
		} else if (i == 1) {
			af.testby_fisher = true
		}
		// must call this to reset axis label after changing test method
		may_setup_numerical_axis(tk)
		tk.load()
	})
	af.dom.testmethod_select.append('option').text('Value difference')
	af.dom.testmethod_option_fisher = af.dom.testmethod_select.append('option').text('Fisher exact test')
}

function make_option_termfilter(af, tk, block, table) {
	// make legend row of termfilter, a <select> for restricting to a category
	if (!af.termfilter) return
	const tr = table.append('tr')
	const td = tr.append('td').attr('colspan', 3)
	td.append('span')
		.text('RESTRICT TO')
		.style('padding', '6px')
		.style('margin', '3px 5px')
		.style('font-size', '.7em')
	const select = td.append('select').on('change', async () => {
		const i = select.node().selectedIndex
		if (i == 0) {
			af.termfilter.inuse = false
		} else {
			af.termfilter.inuse = true
			af.termfilter.value_index = i - 1
		}
		/*
			must remake any termdb group
			as legend update() will not remake AFtest ui,
			and the tvs ui scopes tvslst and will not update unless made anew
			*/
		for (const g of af.groups) {
			if (g.is_termdb) {
				show_group_termdb(g, tk, block)
			}
		}
		select.property('disabled', true)
		await tk.load()
		select.property('disabled', false)
	})
	af.dom.termfilter_select = select
	if (af.termfilter.disabled) {
		select.property('disabled', true)
	}
	af.dom.termfilter_options = []
	af.dom.termfilter_options.push(select.append('option').text('No restriction'))
	for (const v of af.termfilter.values) {
		af.dom.termfilter_options.push(select.append('option').text(v.label || v.key))
	}
}

function updatesetting_bygroupselection(tk) {
	/*
update setting and flags by group selection
will also flip <select>
must run after af.dom{} is all set

call at:
1. end of make_ui
2. after changing population
   as different pops may allow termfilter or not

toggle following flags, do not alter doms:
1. population.adjust_race
2. af.testby_fisher, by_AFddiff
3. af.termfilter.inuse, disabled

*/
	const af = tk.vcf.numerical_axis.AFtest

	if (af.groups[0].is_population && af.groups[1].is_population) {
		// both groups are populations, do not adjust race
		af.groups[0].adjust_race = false
		af.groups[1].adjust_race = false
	} else {
		// not both are population
		const popgroup = af.groups.find(i => i.is_population)
		if (popgroup) {
			// has pop group
			if (popgroup.allowto_adjust_race) {
				// allowed to adjust race
				popgroup.adjust_race = af.groups.find(i => i.is_termdb) != undefined
			} else {
				delete popgroup.adjust_race
			}
		}
	}

	if (af.testby_fisher) {
		// if using fisher test, do not allow info group
		if (af.groups.find(i => i.is_infofield)) {
			af.testby_fisher = false
			af.testby_AFdiff = true
			af.dom.testmethod_option_fisher.property('disabled', true)
		} else {
			// do not disable
			af.dom.testmethod_option_fisher.property('disabled', false)
		}
	}
	af.dom.testmethod_select.node().selectedIndex = af.testby_AFdiff ? 0 : 1

	if (af.termfilter) {
		// termfilter available
		// if condition does not apply then turn off and disable
		af.termfilter.disabled = false
		if (!af.groups.find(i => i.is_termdb)) {
			// no termdb group
			// must has at least one population that supports it
			if (
				!af.groups.find(i => {
					if (i.is_population) {
						const g = tk.populations.find(g => g.key == i.key)
						if (g && g.termfilter) return i
					}
					return
				})
			) {
				// no pop either
				af.termfilter.inuse = false
				af.termfilter.disabled = true
			}
		}
		if (af.termfilter.disabled) {
			af.dom.termfilter_select.property('disabled', true)
		} else {
			af.dom.termfilter_select.property('disabled', false)
			// not disabled
			const popgroups = af.groups.filter(i => i.is_population)
			if (popgroups.length) {
				// has population
				// for those population supporting the termfilter, it may lack a set corresponding to a value in <select>
				// in this case the <option> for this value will be disabled
				const idx_disabled = new Set()
				for (const [value_idx, v] of af.termfilter.values.entries()) {
					for (const p of popgroups) {
						const p2 = tk.populations.find(i => i.key == p.key)
						if (p2.termfilter) {
							// supports termfilter
							if (!p2.sets.find(s => s.termfilter_value == v.key)) {
								// this value is not present in this population
								idx_disabled.add(value_idx)
								break
							}
						}
					}
				}
				if (idx_disabled.size) {
					for (const idx of idx_disabled) {
						af.dom.termfilter_options[idx + 1].property('disabled', true)
					}
					if (idx_disabled.has(af.termfilter.value_index)) {
						af.termfilter.inuse = false
					}
				} else {
					// no opt is disabled
					for (const o of af.dom.termfilter_options) o.property('disabled', false)
				}
			}
		}
		af.dom.termfilter_select.node().selectedIndex = af.termfilter.inuse ? 1 + af.termfilter.value_index : 0
	}
}

function menu_editgroup(tk, block, group) {
	/*
a menu for changing type/content of one group from AFtest

groupindex:
	array index of AFtest.groups[]

*/
	const af = tk.vcf.numerical_axis.AFtest
	const tip = tk.legend.tip.clear()

	const tabs = []

	if (tk.mds && tk.mds.termdb) {
		let activeCohort
		if (group.filter) {
			const cohortFilter = getFilterItemByTag(group.filter, 'cohortFilter')
			if (cohortFilter && tk.mds.termdb.selectCohort) {
				const defaultCohort = cohortFilter.tvs.values
					.map(d => d.key)
					.sort()
					.join(',')
				activeCohort = tk.mds.termdb.selectCohort.values.findIndex(v => v.keys.sort().join(',') === defaultCohort)
			}
		}
		tabs.push({
			label: 'Clinical info',
			callback: async div => {
				const obj = {
					holder: div,
					state: {
						genome: block.genome.name,
						dslabel: tk.mds.label,
						activeCohort
						/*
					 	TODO: may need to handle a cohort filter option in an optional termdb app filter component 
					  termfilter: {
							filter: [{type: 'tvs', renderAs: 'htmlSelect', tvs: {...}}]
					  },
						***/
					},
					barchart: {
						bar_click_override: tvslst => {
							tip.hide()
							if (tvslst.length == 0) return // should not happen
							const cohortFilter = tvslst.find(d => d.tag === 'cohortFilter')
							if (cohortFilter) {
								cohortFilter.renderAs = 'htmlSelect'
								cohortFilter.selectOptionsFrom = 'selectCohort'
							}
							group.filter = {
								type: 'tvslst',
								join: tvslst.length == 1 ? '' : 'and',
								in: true,
								lst: tvslst
							}
							delete group.key
							delete group.is_infofield
							delete group.is_population
							/* poor fix because of the poor design of rerendering DOM on every update;
							must delete filter api if the group is already is termdb
							as it will remove all dom elements from this part of the legend
							*/
							delete group.filterApi
							group.is_termdb = true
							_updatetk()
						}
					}
				}
				const filters = filterJoin(get_hidden_filters(tk))
				if (filters) obj.state.termfilter = { filter: filters }
				appInit(obj)
			}
		})
	}

	if (af.allowed_infofields) {
		tabs.push({
			label: 'Numerical value',
			callback: div => {
				for (const i of af.allowed_infofields) {
					if (group.is_infofield && group.key == i.key) {
						// group is currently this one
						continue
					}
					const info = tk.info_fields.find(j => j.key == i.key)
					div
						.append('div')
						.attr('class', 'sja_menuoption')
						.text(info.label)
						.on('click', async () => {
							tip.hide()
							delete group.is_termdb
							delete group.is_population
							delete group.filterApi
							if (group.dom.samplehandle) {
								group.dom.samplehandle.remove()
								delete group.dom.samplehandle
							}
							group.is_infofield = true
							group.key = i.key
							_updatetk()
						})
				}
			}
		})
	}

	if (tk.populations) {
		tabs.push({
			label: 'Population',
			callback: div => {
				for (const population of tk.populations) {
					if (group.is_population && group.key == population.key) {
						continue
					}
					div
						.append('div')
						.attr('class', 'sja_menuoption')
						.text(population.label)
						.on('click', async () => {
							tip.hide()
							delete group.is_termdb
							delete group.is_infofield
							delete group.filterApi
							if (group.dom.samplehandle) {
								group.dom.samplehandle.remove()
								delete group.dom.samplehandle
							}
							group.is_population = true
							group.key = population.key
							group.allowto_adjust_race = population.allowto_adjust_race
							group.adjust_race = population.adjust_race
							_updatetk()
						})
				}
			}
		})
	}

	client.tab2box(tip.d.append('div').style('margin', '13px'), tabs)

	tip.showunder(group.dom.td1.node())

	async function _updatetk() {
		af.dom.holder.selectAll('*').remove()
		/* quick fix!
		as af.dom.holder has been emptied, so is the filter UI of existing termdb group
		thus must delete the api so as to redo it again
		*/
		af.groups.forEach(i => delete i.filterApi)
		make_ui(tk, block)
		group.dom.td2.text('UPDATING...')
		may_setup_numerical_axis(tk)
		await tk.load()
		group.dom.td2.text(group.is_termdb || group.is_population ? 'ALLELE FREQUENCY OF' : 'VALUE OF')
	}
}

function show_group(tk, block, group) {
	/* display one AFtest group in legend
	 */
	if (group.is_termdb) {
		group.dom.td2.text('ALLELE FREQUENCY OF')
		show_group_termdb(group, tk, block)
		return
	}
	if (group.is_infofield) {
		group.dom.td2.text('VALUE OF')
		show_group_infofield(group, tk)
		return
	}
	if (group.is_population) {
		group.dom.td2.text('ALLELE FREQUENCY OF')
		show_group_population(group, tk)
		return
	}
	group.dom.td3.text('Unknown group type!')
}

function get_hidden_filters(tk) {
	// get the list of hidden filters
	const lst = []
	const v = may_get_param_AFtest_termfilter(tk)
	// keep AFtest.termfilter as a single tvs
	if (v) {
		lst.push({
			type: 'tvslst',
			join: '',
			in: true,
			lst: [{ type: 'tvs', tvs: v }]
		})
	}
	if (tk.sample_termfilter) {
		lst.push(JSON.parse(JSON.stringify(tk.sample_termfilter)))
	}
	return lst
}

function combine_groupfilter_with_hidden(f, tk) {
	/*
f:{}
  the visible filter from a group of AFtest, to be tagged as 'filterUiRoot' 

tk:
  may provide additional hidden filters
*/
	const fcopy = JSON.parse(JSON.stringify(f))
	fcopy.tag = 'filterUiRoot'
	const combined = {
		type: 'tvslst',
		join: 'and',
		in: true,
		lst: [fcopy]
	}
	const hiddenlst = get_hidden_filters(tk)
	if (hiddenlst.length) {
		combined.lst.push(filterJoin(hiddenlst))
	}
	return combined
}

function show_group_termdb(group, tk, block) {
	if (!group.filterApi) {
		group.filterApi = filterInit({
			holder: group.dom.td3,
			vocab: {
				route: 'termdb',
				genome: block.genome.name,
				dslabel: tk.dslabel
			},
			emptyLabel: 'Entire cohort',
			termdbConfig: block.genome.datasets[tk.dslabel].termdb,
			callback: async f => {
				group.filter = f
				await tk.load()
			}
		})
	}
	group.filterApi.main(combine_groupfilter_with_hidden(group.filter, tk)) // async
	if (!group.dom.samplehandle) {
		console.log(501)
		// "n=?, view stats" handle and for porting to term tree filter
		group.dom.samplehandle = group.dom.td3
			.append('span')
			.style('margin-left', '15px')
			.style('opacity', '.6')
			.attr('class', 'sja_clbtext')
			.text('Loading...')
			.on('click', () => {
				// click label to embed tree
				tk.legend.tip.clear().showunder(group.dom.samplehandle.node())
				appInit({
					holder: tk.legend.tip.d.append('div').style('margin', '5px'),
					state: {
						genome: block.genome.name,
						dslabel: tk.mds.label,
						termfilter: {
							filter: group.filterApi.getNormalRoot()
						}
					},
					barchart: {
						bar_click_opts: []
					}
				})
			})
	}
}

function show_group_infofield(group, tk) {
	// group is based on an info field

	const holder = group.dom.td3.append('span')

	const [select, btn] = make_select_btn_pair(holder)

	select.on('change', async () => {
		const value = select.node().value
		const i = tk.info_fields.find(j => j.key == value)
		group.key = value
		btn.html((i ? i.label : value) + '&nbsp; <span style="font-size:.7em">LOADING...</span>')
		await tk.load()
		btn.html((i ? i.label : value) + ' &#9662;')
		select.style('width', btn.node().offsetWidth + 'px')
	})
	for (const i of tk.vcf.numerical_axis.AFtest.allowed_infofields) {
		const i2 = tk.info_fields.find(j => j.key == i.key)
		select
			.append('option')
			.attr('value', i.key)
			.text(i2 ? i2.label : i.key)
	}
	select.node().value = group.key

	const f = tk.info_fields.find(j => j.key == group.key)
	btn
		.style('border-radius', '6px')
		.style('background-color', '#ddd')
		.style('color', 'black')
		.style('padding', '3px 6px 3px 6px')
		.style('margin-left', '5px')
		.html(f.label + ' &#9662;')
	select.style('width', btn.node().offsetWidth + 'px')
}

function show_group_population(group, tk) {
	/*
at group row, show a group
also <select> for changing group
*/
	const holder = group.dom.td3.append('span')

	const p = tk.populations.find(i => i.key == group.key)
	const af = tk.vcf.numerical_axis.AFtest

	const [select, btn] = make_select_btn_pair(holder)

	select.on('change', async () => {
		const value = select.node().value
		const p = tk.populations.find(i => i.key == value)
		group.key = value
		group.allowto_adjust_race = p.allowto_adjust_race
		group.adjust_race = p.adjust_race
		update_adjust_race(adjust_race_div)
		updatesetting_bygroupselection(tk)
		btn.html(p.label + ' &nbsp;<span style="font-size:.7em">LOADING...</span>')
		await tk.load()
		btn.html(p.label + (tk.populations.length > 1 ? ' &#9662;' : ''))
		select.style('width', btn.node().offsetWidth + 'px')
	})
	for (const p of tk.populations) {
		select
			.append('option')
			.attr('value', p.key)
			.text(p.label)
	}
	select.node().value = group.key

	btn
		.style('border-radius', '6px')
		.style('background-color', '#ddd')
		.style('color', 'black')
		.style('padding', '3px 6px 3px 6px')
		.style('margin-left', '5px')
		.html(p.label + (tk.populations.length > 1 ? ' &#9662;' : ''))

	select.style('width', btn.node().offsetWidth + 'px')

	const adjust_race_div = holder.append('span')

	update_adjust_race(adjust_race_div)

	function update_adjust_race(adjust_race_div) {
		adjust_race_div.selectAll('*').remove()

		const p = af.groups.find(i => i.key == group.key)

		if (p.allowto_adjust_race) {
			const label = adjust_race_div.append('label')
			label
				.append('input')
				.attr('type', 'checkbox')
				.style('margin-left', '10px')
				.property('disabled', !af.groups.find(i => i.is_termdb) || !af.groups.find(i => i.is_population))
				.property('checked', p.adjust_race)
				.on('change', async () => {
					p.adjust_race = !p.adjust_race
					lab.html('&nbsp;Loading...')
					await tk.load()
					lab.html('&nbsp;Adjust race background')
				})
			const lab = label.append('span').html('&nbsp;Adjust race background')
		}
	}
}

export function AFtest_groupname(tk, gi) {
	const g = tk.vcf.numerical_axis.AFtest.groups[gi]
	if (!g) throw 'index out of bound'
	if (g.is_infofield) {
		const i = tk.info_fields.find(i => i.key == g.key)
		return i ? i.label : g.key
	}
	if (g.is_population) {
		const i = tk.populations.find(i => i.key == g.key)
		return i ? i.label : g.key
	}
	if (g.is_termdb) {
		return 'Group ' + (gi + 1) // quick fix not having to figure out a non-cohort tvs from g.filter
		/*
		const otherg = tk.vcf.numerical_axis.AFtest.groups[gi == 0 ? 1 : 0]
		if (otherg.is_termdb) {
			// both termdb
			return 'Group ' + (gi + 1)
		}
		// only g is termdb
		const term1name = g.terms[0].term.name
		if (term1name.length <= 20) return term1name
		return term1name.substr(0, 17) + '...'
		*/
	}
	throw 'unknown AFtest group type'
}
