import { legend_newrow } from '#src/block.legend'
import { Menu } from '#dom'
import { JTypes } from '#shared'
import { printCategory } from '../mds3/legend'

/*
 */

export function initLegend(tk, block) {
	// run only once, called by makeTk
	if (!block.legend) return // block has no legend. could be due to hidegenelegend flag
	if (!tk.legend) tk.legend = {}
	tk.legend.tip = new Menu({ padding: '0px' })

	const [tr, td, td0] = legend_newrow(block, tk.custom_data ? tk.name : tk.dslabel)
	tk.legend.headTd = td0 // for updating tk name in legend when filterObj updates

	tk.tr_legend = tr // to be compatible with block.tk_remove()

	const table = td.append('table').style('border-spacing', '5px').style('border-collapse', 'separate')

	tk.legend.table = table
	create_type(tk, block)
}
export function updateLegend(data, tk, block) {
	if (!tk.legend) {
		// if using invalid dslabel, upon initiating initLegend() will not be called
		//and tk.legend may not be created
		return
	}
	update_type(tk)
}
function create_type(tk, block) {
	if (!tk.legend.type) tk.legend.type = {}
	if (!tk.legend.type.hiddenvalues) tk.legend.type.hiddenvalues = new Set()

	if (tk.hiddentypes) {
		// some types to be hidden by default according to ds
		for (const c of tk.hiddentypes.split(',')) tk.legend.type.hiddenvalues.add(c)
		delete tk.hiddentypes
	}

	tk.legend.type.row = tk.legend.table.append('tr')

	tk.legend.type.row
		.append('td')
		.attr('data-testid', 'sjpp-j2-legend-row-type')
		.style('text-align', 'right')
		.style('opacity', 0.7)
		.text(tk.deltaPsiGroups ? tk.deltaPsiGroups.label || 'PSI' : 'Type')

	tk.legend.type.holder = tk.legend.type.row.append('td')
}
function update_type(tk) {
	if (tk.deltaPsiGroups) return update_deltaPsi(tk)
	const type2count = new Map() // k: type, v: count
	for (const j of tk.data) {
		for (const t of j.types) {
			type2count.set(t, 1 + (type2count.get(t) || 0))
		}
	}

	tk.legend.type.holder.selectAll('*').remove()

	for (const [t, c] of [...type2count].sort((i, j) => j[1] - i[1])) {
		// { k, count }
		if (!JTypes[t]) {
			console.log(`unknown splice junction event: '${t}'`)
			continue
		}
		printCategory({
			holder: tk.legend.type.holder,
			key: t,
			label: JTypes[t].name,
			color: JTypes[t].color,
			count: c,
			testid: 'sjpp-j2-legend-row-type-item',
			click: event => {
				const opts = [
					{
						label: 'Hide',
						callback: () => {
							tk.legend.type.hiddenvalues.add(t)
						}
					},
					{
						label: 'Show only',
						callback: () => {
							for (const t2 of type2count.keys()) {
								tk.legend.type.hiddenvalues.add(t2)
							}
							tk.legend.type.hiddenvalues.delete(t)
						}
					},
					{
						label: 'Show all',
						isVisible: () => tk.legend.type.hiddenvalues.size,
						callback: () => {
							tk.legend.type.hiddenvalues.clear()
						}
					}
				]
				tk.legend.tip.clear().showunder(event.target)
				for (const o of opts) {
					if (o.isVisible && o.isVisible() == false) continue
					tk.legend.tip.d
						.append('div')
						.attr('class', 'sja_menuoption')
						.attr('data-testid', `sjpp-legend-option-${o.label.toLowerCase().replace(/\s/g, '-')}`)
						.style('border-radius', '0px')
						.text(o.label)
						.on('click', () => {
							o.callback()
							tk.legend.tip.hide()
							tk.load()
						})
				}
				// definition of the type, as for a class in the mds3 track legend
				const descDiv = tk.legend.tip.d
					.append('div')
					.style('padding', '10px')
					.style('font-size', '.8em')
					.style('width', '150px')
				descDiv.append('span').style('color', JTypes[t].color).text(JTypes[t].name)
				descDiv.append('div').style('color', 'black').text(JTypes[t].desc)
			}
		})
	}

	// hidden ones
	for (const c of tk.legend.type.hiddenvalues) {
		let loading = false

		tk.legend.type.holder
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_clb')
			.style('text-decoration', 'line-through')
			.style('opacity', 0.7)
			.text(JTypes[c].name)
			.on('click', async event => {
				if (loading) return
				loading = true
				tk.legend.type.hiddenvalues.delete(c)
				event.target.innerHTML = 'Updating...'
				await tk.load()
			})
	}
}

/* with tk.deltaPsiGroups, custom junctions are colored by the group with higher PSI, see setColor() in render.js
each category reads as "PSI: A > B"; grey junctions lack the PSI of a group or have equal PSI
*/
function update_deltaPsi(tk) {
	tk.legend.type.holder.selectAll('*').remove()
	const { case: _case, control } = tk.deltaPsiGroups
	const categories = [
		{ key: 'case', label: `${_case.name} > ${control.name}`, color: _case.color },
		{ key: 'control', label: `${control.name} > ${_case.name}`, color: control.color },
		{
			key: undefined,
			label: tk.deltaPsiGroups.noneLabel || 'Equal or missing',
			color: tk.deltaPsiGroups.noneColor || '#858585'
		}
	]
	for (const c of categories) {
		const count = tk.data.filter(j => j.higherPsiIn == c.key).length
		if (!count && !c.key) continue // only show grey when present
		printCategory({
			holder: tk.legend.type.holder,
			key: c.key || 'none',
			label: c.label,
			color: c.color,
			count,
			testid: 'sjpp-j2-legend-row-type-item'
		})
	}
	if (tk.groupTest) describeGroupTest(tk)
}

/* how the junctions are tested between the groups (testJunctionGroups() of the server), in plain words, so that the
track can be read, and explained, from its legend */
function describeGroupTest(tk) {
	const { control, case: _case } = tk.deltaPsiGroups
	const { minSamples, minShare } = tk.groupTest
	const r = tk.groupRegion
	const lines = [
		`How junctions are compared: for each sample, a junction's share is its reads divided by all the junction reads of its gene${
			r ? ` (${r.chr}:${r.start + 1}-${r.stop})` : ' in view'
		}. Shares, not read counts, are compared, so that a gene expressed more does not by itself make its junctions differ.`,
		`The shares of ${_case.name} and ${control.name} are compared with a two-sided Wilcoxon rank-sum test, and q is the Benjamini–Hochberg adjusted p over all the junctions tested.`,
		`Not tested: a junction in fewer than ${minSamples} samples, with a mean share below ${
			minShare * 100
		}% in both groups, or joining two genes or none.`,
		`Height: the difference of the groups' mean shares, in percentage points. Color: the group with the larger share, where q < ${
			tk.deltaPsiGroups.q
		}. Number in a disc: the samples with at least ${tk.readcountCutoff || 1} read${
			tk.readcountCutoff > 1 ? 's' : ''
		} of the junction.`,
		"Click a junction, then Details: the junction's share per sample, the value tested, and its read count per sample."
	]
	tk.legend.type.holder
		.append('div')
		.attr('data-testid', 'sjpp-j2-legend-group-test')
		.style('max-width', '700px')
		.style('margin-top', '5px')
		.style('font-size', '.8em')
		.style('opacity', 0.8)
		.selectAll('div')
		.data(lines)
		.enter()
		.append('div')
		.text(d => d)
}
