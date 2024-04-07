import { deepEqual, copyMerge } from '#rx'
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
		theads = [],
		sectionData,
		dragged = {}

	const self = {
		opts,
		highlightColor: 'none',
		label: `Sort ${l.Samples}`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		expanded: opts.expanded || false,
		expandedSection: '',
		init(overrides = {}) {
			//console.log(32, 'self.init')
			const s = copyMerge(`{}`, parent.config.settings.matrix, overrides)
			self.activeOption = structuredClone(s.sortOptions[s.sortSamplesBy])

			sectionData = [
				{
					label: 'For each selected row, sort cases by matching data',
					handler(div) {
						//div.append('button').html('Select a row')
					},
					tiebreakers: []
				},
				...self.activeOption.sortPriority,
				{
					label: 'Sort cases by name, alphabetically',
					tiebreakers: []
				}
			]

			opts.holder.selectAll('*').remove()
			const topDiv = opts.holder.append('div')
			topDiv.append('button').html('Apply').on('click', apply)
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
				const thead = table
					.append('thead')
					.datum(sd)
					.attr('draggable', true)
					.attr('droppable', true)
					.on('dragstart', trackDraggedSection)
					.on('dragover', highlightSection)
					.on('dragleave', unhighlightSection)
					.on('drop', adjustSortPriority)
				//.on('dragend', adjustSortPriority)

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
		},
		toggleSection,
		trackDraggedSection,
		highlightSection,
		unhighlightSection,
		adjustSortPriority,
		apply
	}

	function toggleSection(event, d = { label: 'all' }) {
		self.expandedSection = self.expandedSection === d.label ? '' : d.label
		self.expanded = !!self.expandedSection
		self.init()
	}

	function trackDraggedSection(event, d) {
		//event.preventDefault()
		dragged.sectionData = d
		dragged.index = self.activeOption.sortPriority.indexOf(d)
	}

	function highlightSection(event, d) {
		if (d == dragged.sectionData) return
		event.preventDefault()
		const i = self.activeOption.sortPriority.indexOf(d)
		const borderSide = i < dragged.index ? 'border-top' : i > dragged.index ? 'border-bottom' : ''
		if (!borderSide) return
		select(this).selectAll('th').style(borderSide, '2px solid blue')
	}

	function unhighlightSection(event, d) {
		event.preventDefault()
		select(this).selectAll('th').style('border', 'none')
	}

	function adjustSortPriority(event, d) {
		if (d == dragged.sectionData) return
		//event.preventDefault()
		const i = self.activeOption.sortPriority.indexOf(d)
		const s = parent.config.settings.matrix
		//console.log(221, self.activeOption)
		const j = i < dragged.index ? i : i + 1
		self.activeOption.sortPriority.splice(dragged.index, 1)
		self.activeOption.sortPriority.splice(j, 0, dragged.sectionData)
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function apply() {
		parent.app.tip?.hide()
		parent.app.dispatch({
			type: 'plot_edit',
			id: parent.id,
			config: {
				settings: {
					matrix: {
						sortOptions: {
							[s.sortSamplesBy]: self.activeOption
						}
					}
				}
			}
		})
	}

	self.init()

	self.api = {
		main: self.init,
		destroy: () => {
			opts.holder.selectAll('*').remove()
		}
	}

	if (opts.debug) self.api.Inner = self
	return self.api
}
