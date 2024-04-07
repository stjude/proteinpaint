import { deepEqual } from '#rx'
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

	let input,
		theads = []
	const self = {
		opts,
		highlightColor: 'none',
		label: `Sort ${l.Samples}`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		expanded: opts.expanded || false,
		expandedSection: '',
		init() {
			const s = parent.config.settings.matrix
			const activeOption = structuredClone(s.sortOptions[s.sortSamplesBy])

			const sectionData = [
				{
					label: 'For each selected row, sort cases by matching data',
					handler(div) {
						//div.append('button').html('Select a row')
					},
					tiebreakers: []
				},
				...activeOption.sortPriority,
				{
					label: 'Sort cases by name, alphabetically',
					tiebreakers: []
				}
			]

			opts.holder.selectAll('*').remove()
			const topDiv = opts.holder.append('div')
			topDiv.append('button').html('Apply')
			topDiv.append('button').html('Reset')

			const table = opts.holder.append('table')

			const tr = table.append('thead')
			tr.append('th').html('Priority').style('text-align', 'left').style('max-width', '0px')
			tr.append('th').html('Data used of sorting')
			tr.append('th')
				.style('text-align', 'center')
				.style('cursor', 'pointer')
				.html(self.expandedSection == 'all' ? '&lt;&lt;' : '...')
				.on('click', toggleSection)
			tr.append('th')
				.attr('colspan', 3)
				.style('display', self.expandedSection ? '' : 'none')
				.html('Data not used for sorting')

			// to track sort priority number
			let i = 0

			for (const sd of sectionData) {
				const thead = table.append('thead').datum(sd).attr('draggable', true).attr('droppable', true)
				//.on('dragenter', )

				theads.push(select(thead))

				const tr = thead.append('tr').style('background-color', '#eee')

				const td12 = tr
					.append('th')
					.attr('colspan', 2)
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'left')
					.on('click', toggleSection)
				td12.append('span').style('margin-right', '12px').style('font-weight', 400).html(sd.label)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'center')
					.style('font-weight', 400)
					.style('cursor', 'pointer')
					.html(self.expandedSection == 'all' || self.expandedSection == sd.label ? '&lt;&lt;' : '...')
					.on('click', toggleSection)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.style('display', self.expandedSection ? '' : 'none')
					.html('Visible')
					.on('click', toggleSection)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.style('display', self.expandedSection ? '' : 'none')
					.html('Hidden')

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.style('display', self.expandedSection ? '' : 'none')
					.html('Case Filter')

				const tbody = table
					.append('tbody')
					.style('display', self.expandedSection == 'all' || self.expandedSection == sd.label ? '' : 'none')

				for (const tb of sd.tiebreakers) {
					// TODO: should handle dictionary variables
					if (!sd.types?.includes('geneVariant')) continue
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
					label
						.append('input')
						.attr('type', 'checkbox')
						.style('vertical-align', 'bottom') //.html('(in listed order ')
						.on('change')

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

					tr.append('td').style('text-align', 'center').html('&nbsp;') //.on('click', toggleSection)
					tr.append('td') //.style('display', 'none')
					tr.append('td') //.style('display', 'none')
					tr.append('td') //.style('display', 'none')
				}

				const lastTr = tbody.append('tr').attr('draggable', true)
				lastTr.append('td').html('&nbsp;')
				lastTr.append('td').style('text-align', 'left').append('button').html('Add a tiebreaker')
				lastTr.append('td').html('&nbsp;')
				lastTr.append('td').html('&nbsp;')
				lastTr.append('td').html('&nbsp;')
			}

			return {
				main: self.init
			}
		}
	}

	// function expandOrCollapse(event, d) {
	// 	self.expanded = !self.expanded
	// 	//console.log(151, self.expandedSection, d)
	// 	//if (self.expanded) self.expandedSection = d.label
	// 	self.expandedSection = self.expanded ? d.label : ''
	// 	self.init()
	// }

	function toggleSection(event, d = { label: 'all' }) {
		self.expandedSection = self.expandedSection === d.label ? '' : d.label
		self.expanded = !!self.expandedSection
		self.init()
	}

	self.init()
	return self
}
