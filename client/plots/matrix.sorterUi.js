import { make_radios } from '#dom/radiobutton'
import { make_one_checkbox } from '#dom/checkbox'
import { mclass } from '#shared/common'
import { select } from 'd3-selection'
import { getConfigForShowAll } from './matrix.interactivity'

/*
	self: matrix controls component instance
	s: settings.matrix 
*/
export function getSorterUi(self, s) {
	console.log(10, s)
	const l = s.controlLabels
	const parent = self.parent
	return {
		highlightColor: 'none',
		label: `Sort ${l.Samples}`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		init(self) {
			self.dom.row.on('mouseover', function () {
				this.style.backgroundColor = '#fff'
				this.style.textShadow = 'none'
			})
			self.dom.row.select(':first-child').style('vertical-align', 'top')
			self.dom.inputTd.style('max-width', '600px')

			// TODO: input for selected matrix row
			const selRowsDiv = self.dom.inputTd
				.append('div')
				.style('margin', '0 10px 5px 5px')
				.style('padding', '5px')
				.style('border-left', '2px solid #ccc')
			selRowsDiv.append('div').style('font-weight', 600).html('By data for each selected row')
			selRowsDiv.append('button').html('Select a row')

			const div2 = self.dom.inputTd
				.append('div')
				.style('margin', '10px 5px')
				.style('padding', '5px')
				.style('border-left', '2px solid #ccc')
			div2.append('div').style('font-weight', 600).html('By data for each gene mutation row, from top to bottom')

			const presenceDiv = div2.append('div').style('margin', '5px')
			const presenceInput = presenceDiv
				.append('input')
				.attr('type', 'checkbox')
				.style('width', '18px')
				.style('opacity', 0)
			const presenceLabel = presenceDiv.append('div').style('display', 'inline-block')
			presenceLabel.append('div').style('display', 'inline-block').style('width', '18px').html('1. ')
			presenceLabel.append('div').style('display', 'inline-block').html('Has SSM > No SSM')

			const cnvDiv = div2.append('div').style('margin', '5px')
			const cnvInput = cnvDiv
				.append('input')
				.attr('type', 'checkbox')
				.style('width', '18px')
				.on('change', () => {
					const s = parent.config.settings.matrix
					const checked = cnvInput.property('checked')
					const config =
						checked && s.showMatrixCNV == 'none'
							? getConfigForShowAll(
									parent,
									parent.legendData.find(l => l.dt?.includes(4)),
									'CNV'
							  )
							: { settings: { matrix: {} } }
					config.settings.matrix.sortByCNV = checked

					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config
					})
				})

			const cnvLabel = cnvDiv.append('div').style('display', 'inline-block')
			const cnvNum = cnvLabel.append('div').style('display', 'inline-block').style('width', '18px').html('2. ')
			cnvLabel
				.append('div')
				.style('display', 'inline-block')
				.html('CNV <i style="color: #aaa">(drag to change sort order)</i>')
			const cnvClasses = cnvDiv
				.append('div')
				//.style('display', 'inline-block')
				.style('margin-left', '42px')
				.selectAll('div')
				.data(s.CNVClasses)
				.enter()
				.append('div')
				.attr('draggable', true)
				.style('display', 'inline-block')
				.style('padding', '2px 3px')
				.style('margin-left', '3px')
				.each(function (d) {
					const div = select(this)
					div
						.append('div')
						.style('display', 'inline-block')
						.style('width', '12px')
						.style('height', '12px')
						.style('margin-right', '3px')
						.style('background-color', key => mclass[key].color)

					div.append('span').html(key => mclass[key].label)
				})

			const ssmDiv = div2.append('div').style('margin', '5px')
			const ssmInput = ssmDiv
				.append('input')
				.attr('type', 'checkbox')
				.style('width', '18px')
				.on('change', () => {
					const s = parent.config.settings.matrix
					const checked = ssmInput.property('checked')
					console.log(98, checked)
					const config =
						checked && s.showMatrixMutation == 'none'
							? getConfigForShowAll(
									parent,
									parent.legendData.find(l => l.dt?.includes(1), 'mutation')
							  )
							: { settings: { matrix: {} } }
					config.settings.matrix.sortByMutation = checked ? 'consequence' : 'presence'

					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config
					})
				})
			const ssmLabel = ssmDiv.append('div').style('display', 'inline-block')
			const ssmNum = ssmLabel.append('div').style('display', 'inline-block').style('width', '18px').html('3. ')
			ssmLabel
				.append('div')
				.style('display', 'inline-block')
				.html('Consequence <i style="color: #aaa">(drag to change sort order)</i>')

			const ssmClasses = ssmDiv
				.append('div')
				.style('margin-left', '42px')
				.selectAll('div')
				.data(s.mutationClasses)
				.enter()
				.append('div')
				.attr('draggable', true)
				.style('display', 'inline-block')
				.style('padding', '2px 3px')
				.style('margin-left', '3px')
				.each(function (d) {
					const div = select(this)
					div
						.append('div')
						.style('display', 'inline-block')
						.style('width', '12px')
						.style('height', '12px')
						.style('margin-right', '3px')
						.style('background-color', key => mclass[key].color)

					div.append('span').html(key => mclass[key].label)
				})

			const div3 = self.dom.inputTd
				.append('div')
				.style('margin', '10px 5px')
				.style('padding', '5px')
				.style('border-left', '2px solid #ccc')
			div3.append('div').style('font-weight', 600).html('By data for each dictionary term row, from top to bottom')

			// const dictDiv = div3.append('div').style('margin', '5px')
			// const dictInput = dictDiv.append('input')
			// 	.attr('type', 'checkbox')
			// 	.style('width', '18px')
			// 	.style('opacity', 0)
			// const dictLabel = dictDiv.append('div').style('display', 'inline-block')
			// const dictNum = dictLabel.append('div').style('display', 'inline-block').style('width', '18px').html('4. ')
			// dictLabel.append('div').style('display', 'inline-block').html('Dictionary term values')

			const div4 = self.dom.inputTd
				.append('div')
				.style('margin', '10px 5px')
				.style('padding', '5px')
				.style('border-left', '2px solid #ccc')
			div4.append('div').style('font-weight', 600).html('By case name, alphabetically')

			return {
				main: plot => {
					const s = plot.settings.matrix
					// ssm
					ssmInput.property('checked', s.sortByMutation == 'consequence')
					// cnv
					cnvInput.property('checked', s.sortByCNV)
					//cnvDiv.style('display', s.showMatrixCNV != 'none' && !s.allMatrixCNVHidden ? 'block' : 'none')
				}
			}
		}
	}
}
