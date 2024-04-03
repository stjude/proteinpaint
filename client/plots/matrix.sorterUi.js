import { make_radios } from '#dom/radiobutton'
import { make_one_checkbox } from '#dom/checkbox'

/*
	self: matrix controls component instance
	s: settings.matrix 
*/
export function getSorterUi(self, s) {
	const l = s.controlLabels
	const parent = self.parent
	return {
		label: `Sort ${l.Sample} Priority`,
		title: `Set how to sort ${l.samples}`,
		type: 'custom',
		init(self) {
			const ssmDiv = self.dom.inputTd.append('div')
			ssmDiv.append('span').html('SSM')
			const { inputs } = make_radios({
				// holder, options, callback, styles
				holder: ssmDiv.append('span'),
				options: [
					{ label: 'by consequence', value: 'consequence' },
					{ label: 'by presence', value: 'presence', checked: true }
				],
				styles: {
					display: 'inline-block'
				},
				callback: value => {
					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config: {
							settings: {
								matrix: {
									sortByMutation: value
								}
							}
						}
					})
				}
			})

			inputs.style('margin', '2px 0 0 2px').style('vertical-align', 'top')

			const cnvDiv = self.dom.inputTd.append('div')
			cnvDiv.append('span').html('CNV')
			// holder, labeltext, callback, checked, divstyle
			const input = make_one_checkbox({
				holder: cnvDiv.append('span'),
				divstyle: { display: 'inline-block' },
				checked: false,
				labeltext: 'sort by CNV',
				callback: () => {
					parent.app.dispatch({
						type: 'plot_edit',
						id: parent.id,
						config: {
							settings: {
								matrix: {
									sortByCNV: input.property('checked')
								}
							}
						}
					})
				}
			})

			//self.dom.inputTd.append('div').append('span').html('By case name')

			return {
				main: plot => {
					const s = plot.settings.matrix
					// ssm
					inputs.property('checked', d => d.value == s.sortByMutation)
					// cnv
					input.property('checked', s.sortByCNV)
					cnvDiv.style('display', s.showMatrixCNV != 'none' && !s.allMatrixCNVHidden ? 'block' : 'none')
				}
			}
		}
	}
}
