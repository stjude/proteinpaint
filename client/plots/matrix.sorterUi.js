import { make_radios } from '#dom/radiobutton'
import { make_one_checkbox } from '#dom/checkbox'
import { mclass } from '#shared/common'
import { select } from 'd3-selection'
import { getConfigForShowAll } from './matrix.interactivity'

/*
	controls: matrix controls component instance
	s: settings.matrix 
*/
export function getSorterUi(opts) {
	const { controls, holder } = opts
	const parent = controls.parent
	const s = parent.config.settings.matrix
	const l = s.controlLabels

	let input
	const self = {
		highlightColor: 'none',
		label: `Sort ${l.Samples}`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		expanded: opts.expanded || false,
		expandedSection: '',
		init() {
			const s = parent.config.settings.matrix
			const activeOption = s.sortOptions[s.sortSamplesBy]

			const sectionData = [
				{
					label: 'By data for each selected row',
					handler(div) {
						//div.append('button').html('Select a row')
					},
					tiebreakers: []
				},
				...activeOption.sortPriority,
				{
					label: 'By case name, alphabetically',
					tiebreakers: []
				}
			]

			opts.holder.selectAll('*').remove()
			opts.holder.append('div').append('button').html('Apply')
			const table = opts.holder.append('table')

			const tr = table.append('thead')
			tr.append('th').html('Priority')
			tr.append('th').html('Data used of sorting')
			tr.append('th')
				.attr('colspan', 3)
				.html(!self.expanded ? '...' : 'Data not used for sorting')
				.on('click', expandOrCollapse)

			let i = 0
			for (const sd of sectionData) {
				const thead = table.append('thead').datum(sd).attr('draggable', true)
				const tr = thead.append('tr').style('background-color', '#eee')

				const td12 = tr
					.append('th')
					.attr('colspan', 2)
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'left')
					.on('click', toggleSection)
				td12.append('span').style('margin-right', '12px').style('font-weight', 400).html(sd.label)
				td12
					.append('button')
					.style('height', '20px')
					.style('float', 'right')
					.html(self.expandedSection == sd.label ? '&minus;' : '+')
					.on('click', sd.handler)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.html(!self.expanded ? '...' : '< Visible')
					.on('click', expandOrCollapse)
				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('display', !self.expanded ? 'none' : '')
					.html('Hidden')
				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('display', !self.expanded ? 'none' : '')
					.html('Case Filter')

				const tbody = table.append('tbody').style('display', self.expandedSection == sd.label ? '' : 'none')
				if (!sd.tiebreakers?.length || !sd.types?.includes('geneVariant')) continue
				for (const tb of sd.tiebreakers) {
					const tr = tbody.append('tr').attr('draggable', true)
					if (!tb.disabled) i++
					tr.append('td')
						.style('padding', '5px')
						.style('vertical-align', 'top')
						.html(!tb.disabled ? i : '&nbsp;') // TODO: show pr
					const td2 = tr.append('td').style('padding', '5px').style('vertical-align', 'top').style('max-width', '500px')
					td2.append('span').html(tb.label || '')

					const label = td2.append('label')
					label.append('span').html(' (in listed order ')
					label.append('input').attr('type', 'checkbox').style('vertical-align', 'bottom') //.html('(in listed order ')

					label.append('span').html(')')
					td2
						.append('div')
						.selectAll('div')
						.data(tb.order)
						.enter()
						.append('div')
						.style('display', 'inline-block')
						.each(function (key) {
							const div = select(this).attr('draggable', true).style('margin-right', '10px')
							const cls = mclass[key]
							div
								.append('div')
								.style('display', 'inline-block')
								.style('width', '12px')
								.style('height', '12px')
								.style('margin-right', '3px')
								.style('background-color', cls.color)
							div.append('span').html(cls.label)
						})

					if (!self.expanded) {
						tr.append('td').html('...').on('click', expandOrCollapse)
						tr.append('td').style('display', 'none')
						tr.append('td').style('display', 'none')
					} else {
						tr.append('td') //.style('display', '')
						tr.append('td')
						tr.append('td')
					}
				}
			}

			return {
				main: plot => {
					const s = plot.settings.matrix
					// ssm
					// ssmInput.property('checked', s.sortByMutation == 'consequence')
					// cnv
					// cnvInput.property('checked', s.sortByCNV)
					//cnvDiv.style('display', s.showMatrixCNV != 'none' && !s.allMatrixCNVHidden ? 'block' : 'none')
				}
			}
		}
	}

	function expandOrCollapse(event, d) {
		self.expanded = !self.expanded
		//console.log(151, self.expandedSection, d)
		if (self.expanded) self.expandedSection = d.label
		self.init()
	}

	function toggleSection(event, d) {
		self.expandedSection = self.expandedSection === d.label ? '' : d.label
		self.init()
	}

	self.init()
	return self
}
