import { select } from 'd3-selection'
import { deepEqual, copyMerge } from '#rx'
import { make_radios } from '#dom/radiobutton'
import { make_one_checkbox } from '#dom/checkbox'
import { Menu } from '#dom/menu'
import { mclass } from '#shared/common'
import { getConfigForShowAll } from './matrix.interactivity'
import { setComputedConfig } from './matrix.config'

const tip = new Menu({ padding: '' })
const alphabet = `ABCDEFGHIJKLMNOPQRSTUVWXYZ`.split('')

/*
	controls: matrix controls component instance
	s: settings.matrix 
*/
export function getSorterUi(opts) {
	const { controls, holder } = opts
	const parent = controls.parent
	const s = parent.config.settings.matrix
	const l = s.controlLabels
	const unusedDisplayByLabel = new Map()

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
		expandedSection: opts.expandedSection || '',
		init(overrides = {}) {
			const s = copyMerge(`{}`, parent.config.settings.matrix, overrides)
			self.settings = s
			self.activeOption = structuredClone(s.sortOptions[s.sortSamplesBy])

			sectionData = [
				{
					label: 'For each selected row, sort cases by matching data',
					notDraggable: true,
					handler(div) {
						//div.append('button').html('Select a row')
					},
					tiebreakers: []
				},
				...self.activeOption.sortPriority,
				{
					label: 'Sort cases by name, alphabetically',
					notDraggable: true,
					tiebreakers: []
				}
			]

			opts.holder.selectAll('*').remove()
			const topDiv = opts.holder.append('div')
			topDiv.append('button').html('Apply').on('click', apply)
			topDiv.append('button').html('Reset').on('click', self.init)

			const table = opts.holder.append('table')

			const tr = table.append('thead')
			tr.append('th').html('Priority').style('text-align', 'left').style('max-width', '0px')
			tr.append('th').html('Description')
			tr.append('th').html('Action')

			// to track sort priority number
			let i = 0,
				j = 0

			for (const sd of sectionData) {
				const thead = table
					.append('thead')
					.datum(sd)
					.attr('draggable', !sd.notDraggable)
					.attr('droppable', !sd.notDraggable)
					.on('dragstart', trackDraggedSection)
					.on('dragover', highlightSection)
					.on('dragleave', unhighlightSection)
					.on('drop', adjustSortPriority)

				theads.push(select(thead))

				const tr = thead.append('tr').style('background-color', '#eee')
				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('font-weight', 400)
					.html(alphabet[j++])
					.on('click', toggleSection)
				const td2 = tr
					.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'left')
					.on('click', toggleSection)
				td2.append('span').style('margin-right', '12px').style('font-weight', 400).html(sd.label)

				tr.append('th')
					.style('padding', '5px')
					.style('vertical-align', 'top')
					.style('text-align', 'center')
					.style('font-weight', 400)
					.style('cursor', 'pointer')
					.append('button')
					.html('Add')
					.on('click', toggleSection)

				const tbody = table
					.append('tbody')
					.datum(sd)
					.style('display', self.expandedSection == 'all' || self.expandedSection == sd.label ? '' : 'none')

				for (const tb of sd.tiebreakers) {
					// TODO: should handle dictionary variables
					if (!sd.types?.includes('geneVariant')) continue
					const tr = tbody
						.append('tr')
						.datum(tb)
						.attr('draggable', true)
						.attr('droppable', true)
						.on('dragstart', trackDraggedTieBreaker)
						.on('dragover', highlightTieBreaker)
						.on('dragleave', unhighlightTieBreaker)
						.on('drop', adjustTieBreakers)

					if (!tb.disabled) i++
					const td1 = tr
						.append('td')
						.attr(
							'title',
							tb.disabled
								? `This tiebreaker is currently not being used to sort ${l.cases}. Check the box to use.`
								: `The number indicates the order in which this tiebreaker is used. Unched the box to skip.`
						)
						.datum(tb)
					td1.style('padding', '5px').style('vertical-align', 'top').style('text-align', 'center')
					td1.append('span').html(!tb.disabled ? i : '') // TODO: show pr
					//td1.append('br')

					const td2 = tr
						.append('td')
						.style('opacity', tb.disabled ? 0.5 : 1)
						.style('padding', '5px')
						.style('vertical-align', 'top')
						.style('max-width', '500px')
					td2.append('span').html(tb.label || '')

					const label = td2.append('label')
					label.append('span').html(' (use data list order ')
					if (!tb.isOrdered) tb.isOrdered = false
					const checkbox = label
						.append('input')
						.datum(tb)
						.attr('type', 'checkbox')
						.property('checked', tb.isOrdered)
						.style('vertical-align', 'bottom') //.html('(in listed order ')
						.on('change', toggleTieBreakerIsOrdered)

					label.append('span').html(')')

					const order = tb.order //.filter(cls => !s.hiddenVariants.includes(cls))
					td2
						.append('div')
						.attr('class', 'sjpp-matrix-sorter-ui-value')
						.selectAll('div')
						.data(
							order.map((key, index) => ({
								lstName: 'order',
								key,
								cls: mclass[key],
								tb,
								dragstart: trackDraggedValue,
								dragover: highlightValue,
								dragleave: unhighlightValue,
								drop: adjustValueOrder,
								filterByClass: s.filterByClass,
								index
							}))
						)
						.enter()
						.append('div')
						.style('display', tb.isOrdered ? 'block' : 'inline-block')
						.each(setValueDiv)

					if (tb.notUsed?.length) {
						const notUsed = td2.append('div')
						if (!unusedDisplayByLabel.has(tb.label)) unusedDisplayByLabel.set(tb.label, 'none')

						notUsed //.append('td')
							.append('div')
							.attr('data-testid', 'sjpp-matrix-sorter-ui-hidden-add')
							.style('display', 'inline-block')
							.style('padding', '5x')
							.style('vertical-align', 'top')
							.style('padding', '3px 5px')
							.style('cursor', 'pointer')
							.html(`+Add`)
							.on('click', () => {
								unusedDisplayByLabel.set(
									tb.label,
									unusedDisplayByLabel.get(tb.label) == 'inline-block' ? 'none' : 'inline-block'
								)
								availDiv.style('display', unusedDisplayByLabel.get(tb.label))
							})

						const availDiv = notUsed
							.append('div')
							.attr('data-testid', 'sjpp-matrix-sorter-ui-hidden-vals')
							.style('margin-top', '3px')
							.style('vertical-align', 'top')
							.style('padding-left', '12px')
							.style('display', unusedDisplayByLabel.get(tb.label))

						availDiv
							.selectAll('div')
							.data(
								tb.notUsed.map((key, index) => ({
									lstName: 'notUsed',
									key,
									cls: mclass[key],
									tb,
									dragstart: trackDraggedValue,
									dragover: highlightValue,
									dragleave: unhighlightValue,
									drop: adjustValueOrder,
									filterByClass: s.filterByClass,
									index
								}))
							)
							.enter()
							.append('div')
							.style('display', 'inline-block')
							.each(setValueDiv)
					}

					const td3 = tr.append('td').style('text-align', 'center').style('vertical-align', 'top')

					const btn = td3
						.append('button')
						.datum(tb)
						.html(tb.disabled ? 'Enable' : 'Disable')
						.on('click', toggleTieBreakerDisabled)
				}

				const lastTr = tbody.append('tr').attr('draggable', true)
				lastTr.append('td').html('&nbsp;')
				lastTr.append('td').style('text-align', 'left') //.append('button').html('Add')
				lastTr.append('td').html('&nbsp;')
			}
		},
		toggleSection,
		trackDraggedSection,
		highlightSection,
		unhighlightSection,
		adjustSortPriority,

		trackDraggedTieBreaker,
		highlightTieBreaker,
		unhighlightTieBreaker,
		adjustTieBreakers,

		trackDraggedValue,
		highlightValue,
		unhighlightValue,
		adjustValueOrder,

		apply
	}

	function toggleSection(event, d = { label: 'all' }) {
		self.expandedSection = self.expandedSection === d.label ? '' : d.label
		self.expanded = !!self.expandedSection
		self.init()
	}

	function trackDraggedSection(event, d) {
		dragged.type = 'sortPriority'
		dragged.data = d
		dragged.index = self.activeOption.sortPriority.indexOf(d)
	}

	function highlightSection(event, d) {
		if (dragged.type != 'sortPriority' || d == dragged.data) return
		event.preventDefault()
		const i = self.activeOption.sortPriority.indexOf(d)
		const borderSide = i < dragged.index ? 'border-top' : i > dragged.index ? 'border-bottom' : ''
		if (!borderSide) return
		select(this).selectAll('th').style(borderSide, '2px solid blue')
	}

	function unhighlightSection(event, d) {
		if (dragged.type != 'sortPriority') return
		event.preventDefault()
		select(this).selectAll('th').style('border', 'none')
	}

	function adjustSortPriority(event, d) {
		if (d == dragged.data) return
		//event.preventDefault()
		const i = self.activeOption.sortPriority.indexOf(d)
		const s = parent.config.settings.matrix
		self.activeOption.sortPriority.splice(dragged.index, 1)
		self.activeOption.sortPriority.splice(i, 0, dragged.data)
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function trackDraggedTieBreaker(event, d) {
		dragged.type = 'tiebreaker'
		dragged.data = d
		dragged.sectionData = event.target.closest('tbody').__data__
		dragged.priorityIndex = self.activeOption.sortPriority.indexOf(dragged.sectionData)
		dragged.index = dragged.sectionData.tiebreakers.indexOf(d)
	}

	function highlightTieBreaker(event, d) {
		if (dragged.type != 'tiebreaker' || d == dragged.data) return
		event.preventDefault()
		const i = dragged.sectionData.tiebreakers.indexOf(d)
		const borderSide = i < dragged.index ? 'border-top' : i > dragged.index ? 'border-bottom' : ''
		if (!borderSide) return
		select(this).selectAll('td:nth-child(2)').style(borderSide, '2px solid blue')
	}

	function unhighlightTieBreaker(event, d) {
		if (dragged.type != 'tiebreaker') return
		event.preventDefault()
		select(this).selectAll('td:nth-child(2)').style('border', 'none')
	}

	function toggleTieBreakerIsOrdered(event, tb) {
		event.stopPropagation()
		tb.isOrdered = !tb.isOrdered
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function toggleTieBreakerDisabled(event, tb) {
		event.stopPropagation()
		tb.disabled = !tb.disabled
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function adjustTieBreakers(event, d) {
		if (dragged.type != 'tiebreaker' || d == dragged.data) return
		event.preventDefault()
		const i = dragged.sectionData.tiebreakers.indexOf(d)
		const s = parent.config.settings.matrix
		dragged.sectionData.tiebreakers.splice(dragged.index, 1)
		dragged.sectionData.tiebreakers.splice(i, 0, dragged.data)
		self.init({
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	function setValueDiv(d) {
		const title = []
		if (d.tb.notUsed?.includes(d.key)) title.push(`Click to use for sorting ${l.samples}.`)
		if (d.filterByClass[d.key] == 'value') title.push('Hidden value')
		if (d.filterByClass[d.key] == 'case') title.push('Case filter')

		const skipped = d.tb.notUsed?.includes(d.key)
		const opacity = d.filterByClass[d.key] == 'value' ? 0.5 : 1
		const div = select(this)
			.attr('title', title.join(','))
			.attr('draggable', d.tb.isOrdered ? true : false)
			.attr('droppable', d.tb.isOrdered ? true : false)
			.style('width', 'fit-content')
			.style('margin-right', '10px')
			.style('overflow', 'hidden')
			.style('white-space', 'nowrap')
			.style('opacity', opacity)
			.style('cursor', 'pointer')
			.on('dragstart', d.dragstart)
			.on('dragover', d.dragover)
			.on('dragleave', d.dragleave)
			.on('drop', d.drop)
			.on('mouseenter', () => toggle.style('opacity', 1))
			.on('mouseleave', () => toggle.style('opacity', 0))
			.on('click', () => {
				const targetLstName = d.lstName == 'order' ? 'notUsed' : 'order'
				if (!d.tb[targetLstName]) d.tb[targetLstName] = []
				const targetLst = d.tb[targetLstName]
				d.tb[d.lstName].splice(d.index, 1)
				if (d.lstName == 'order') targetLst.unshift(d.key)
				else targetLst.push(d.key)
				self.init({
					sortOptions: {
						[s.sortSamplesBy]: self.activeOption
					}
				})
			})
		//.on('click', showValueMenu)
		// .on('mouseenter', () => {
		// 	div.style(wh, '')//.style('opacity', '')
		// })
		// .on('mouseleave', (event, d) => {
		// 	div.style(wh, d.tb.skipped?.includes(d.key) ? '12px' : '')//.style('opacity', 0.5)
		// })

		div
			.append('div')
			.style('display', 'inline-block')
			.style('cursor', 'pointer')
			.style('width', '12px')
			.style('height', '12px')
			.style('margin-right', '3px')
			.style('background-color', d.cls.color)
		div
			.append('span')
			.style('cursor', 'pointer')
			.style('text-decoration', d.filterByClass[d.key] == 'case' ? 'line-through' : '')
			.html((d.filterByClass[d.key] ? '(<i>not used</i>) ' : '') + d.cls.label)

		const toggle = div
			.append('div')
			.style('display', 'inline-block')
			.style('width', '12px')
			.style('cursor', 'pointer')
			.style('opacity', 0)
			.style('color', d.lstName == 'order' ? 'red' : 'green')
			.html(d.lstName == 'order' ? '&cross;' : '&check;')
	}

	function trackDraggedValue(event, d) {
		event.stopPropagation?.()
		dragged.type = 'value'
		dragged.data = d
		dragged.sectionData = event.target.closest('tbody').__data__
		dragged.priorityIndex = self.activeOption.sortPriority.indexOf(dragged.sectionData)
		dragged.tiebreaker = event.target.closest('tr').__data__
		dragged.tbIndex = dragged.sectionData.tiebreakers.indexOf(dragged.priorityIndex)
		dragged.order = dragged.tiebreaker.order
	}

	function highlightValue(event, d) {
		event.stopPropagation?.()
		if (dragged.type != 'value' || d == dragged.data) return
		if (d.tb != dragged.data.tb) return
		event.preventDefault()
		const i = dragged.order.indexOf(d)
		select(this).style('border', '2px solid blue')
	}

	function unhighlightValue(event, d) {
		event.stopPropagation?.()
		if (dragged.type != 'value') return
		event.preventDefault()
		select(this).style('border', 'none')
	}

	function adjustValueOrder(event, d) {
		event.stopPropagation?.()
		if (dragged.type != 'value' || d == dragged.data) return
		event.preventDefault()

		const s = self.settings
		dragged.data.tb[dragged.data.lstName].splice(dragged.data.index, 1)
		d.tb[d.lstName].splice(d.index, 0, dragged.data.key)
		// if (dragged.data.lstName == d.lstName) {
		// 	const i = dragged.order.indexOf(d.key)
		// 	dragged.order.splice(i, 0, dragged.data.key)
		// } else { console.log(44, d, d.tb[d.lstName])
		// 	d.tb[d.lstName].push(dragged.data.key)
		// }

		const j = s.hiddenVariants.indexOf(dragged.data.key)
		const hiddenVariants = structuredClone(s.hiddenVariants)
		const filterByClass = structuredClone(s.filterByClass)
		if (j != -1) {
			hiddenVariants.splice(j, 1)
			filterByClass[dragged.data.key] = false
		}
		self.init({
			hiddenVariants,
			filterByClass,
			sortOptions: {
				[s.sortSamplesBy]: self.activeOption
			}
		})
	}

	// function showValueMenu(event, d) {
	// 	event.stopPropagation?.()
	// 	tip.clear()
	// 	const s = parent.config.settings.matrix
	// 	const l = s.controlLabels
	// 	make_one_checkbox({
	// 		holder: tip.d.append('div'),
	// 			labeltext: 'Do not use this data value to sort cases',
	// 			checked: d.tb.skipped.includes(d.key),
	// 			style: {padding: '5px'},
	// 			callback: checked => {
	// 				tip.hide()
	// 				if (!d.tb.skipped) d.tb.skipped = []
	// 				const i = d.tb.skipped.indexOf(d.key)
	// 				if (checked && i == -1) d.tb.skipped.push(d.key)
	// 				else if (!checked && i != -1) d.tb.skipped.splice(i, 1)
	// 				self.init({
	//  				sortOptions: {
	// 					[s.sortSamplesBy]: self.activeOption
	// 				}
	// 			})
	// 			}
	// 	})

	// 	const fbk = s.filterByClass[d.key] || ''
	// 	make_radios({
	// 		holder: tip.d.append('div'),
	// 			options: [{
	// 				label: `Show ${d.cls.label}, do not use to filter ${l.samples}`,
	// 				value: '',
	// 				checked: fbk != 'value' && fbk != 'case'
	// 			},{
	// 				label: `Do not show ${d.cls.label}`,
	// 				value: 'value',
	// 				checked: fbk == 'value'
	// 			},{
	// 				label: `Hide ${l.samples} with ${d.cls.label}`,
	// 				value: 'case',
	// 				checked: fbk == 'case'
	// 			}],
	// 			// checked: d.tb.skipped.includes(d.key),
	// 			style: {padding: '5px'},
	// 			callback: value => {
	// 				tip.hide()
	// 				//const config = structuredClone(parent.config)
	// 				self.init({
	//  				sortOptions: {
	// 					[s.sortSamplesBy]: self.activeOption
	// 				}
	// 			})
	// 			}
	// 	})

	// 	tip.showunder(this)
	// }

	function apply(edits = {}) {
		parent.app.tip?.hide()
		parent.app.dispatch({
			type: 'plot_edit',
			id: parent.id,
			config: {
				settings: copyMerge(
					{
						matrix: {
							sortOptions: {
								[s.sortSamplesBy]: self.activeOption
							}
						}
					},
					edits
				)
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
