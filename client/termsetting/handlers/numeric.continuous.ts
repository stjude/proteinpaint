import { getPillNameDefault } from '../termsetting'
import { PillData, Term } from '../../shared/types/index'
import { makeDensityPlot } from '../../filter/densityplot'
import { convertViolinData } from '../../filter/tvs.numeric'
import { HandlerGenerator } from '../types'

/*
********************** EXPORTED
getHandler(self)
	- self: a termsetting instance
	getPillName()
	getPillStatus()

	showEditMenu(div): continuous edit menu
	- sequence of function calls:
		setqDefaults() // set self.q from self.numqByTermIdModeType
*/

//Types

type DropDownOpt = { html: string; value: number }

export function getHandler(self) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			return { text: 'continuous' } // FIXME not effective
		},

		async showEditMenu(div: any) {
			setqDefaults(self)

			div.style('padding', '5px').selectAll('*').remove()

			const densityDiv = div.append('div')
			const plot_size = {
				width: 500,
				height: 100,
				xpad: 10,
				ypad: 20
			}
			const d = await self.vocabApi.getViolinPlotData(
				{
					termid: self.term.id,
					filter: self.filter,
					svgw: plot_size.width,
					orientation: 'horizontal',
					datasymbol: 'bean',
					radius: 5,
					strokeWidth: 0.2
				},
				self.opts.getBodyParams?.()
			)
			const density_data = convertViolinData(d)
			const svg = densityDiv.append('svg')
			const density_plot_opts = {
				svg: svg,
				data: density_data,
				term: self.term,
				plot_size: plot_size
			}
			makeDensityPlot(density_plot_opts)

			div.append('div').style('display', 'inline-block').style('padding', '3px 10px').html('Scale values')

			const select = div.append('select').on('change', (event: any) => {
				if (!self.q) throw `Missing .q{} [numeric.continuous getHandler()]`
				if (event.target.value != '1') self.q.scale = Number(event.target.value)
				else delete self.q.scale
			})

			select
				.selectAll('option')
				.data([
					{ html: 'No Scaling', value: 1 },
					{ html: 'Per 10', value: 10 },
					{ html: 'Per 100', value: 100 },
					{ html: 'Per 1000', value: 1000 }
				])
				.enter()
				.append('option')
				.attr('value', (d: DropDownOpt) => d.value)
				.html((d: DropDownOpt) => d.html)
				.property('selected', (d: DropDownOpt) => 'scale' in self.q! && d.value == self.q.scale)

			const btndiv = div.append('div').style('padding', '3px 10px')

			btndiv
				.append('button')
				.style('margin', '5px')
				.html('Apply')
				.on('click', () => {
					self.q.mode = 'continuous'
					self.runCallback()
				})
		}
	}
}

function setqDefaults(self) {
	const cache = self.numqByTermIdModeType
	const t = self.term as Term
	if (!cache[t.id!]) cache[t.id!] = {}
	if (!cache[t.id!].continuous) {
		cache[t.id!].continuous = {
			mode: 'continuous'
		}
	}
	const cacheCopy = JSON.parse(JSON.stringify(cache[t.id!].continuous))
	self.q = Object.assign(cacheCopy, self.q)
	//*** validate self.q ***//
}
