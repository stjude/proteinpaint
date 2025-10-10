import type { NumCustomBins } from '#tw'
import type { NumDiscrete } from './NumDiscrete.ts'
import type { TermSetting } from '../TermSetting.ts'

export class NumCustomBinEditor {
	tw: NumCustomBins
	editHandler: NumDiscrete
	termsetting: TermSetting
	opts: any

	constructor(editHandler) {
		this.editHandler = editHandler
		this.opts = editHandler.opts
		this.tw = editHandler.tw
		this.termsetting = editHandler.termsetting
	}

	render(div) {}
}

// self is the termsetting instance
export function getHandler(self) {
	return {
		getPillName(d: PillData) {
			return getPillNameDefault(self, d)
		},

		getPillStatus() {
			if (!self.q) throw `Missing .q{} [numeric.discrete getPillStatus()]`
			const text = self.q?.name || self.q?.reuseId
			if (text) return { text }
			if (self.q.type == 'regular-bin') return { text: 'bin size=' + self.q.bin_size }
			return { text: self.q.lst!.length + ' bins' }
		},

		async showEditMenu(div: any) {
			showBinsMenu(self, div)
		}
	}
}

async function showBinsMenu(handler, div: any) {
	const self = handler.termsetting
	self.num_obj = {}
	if (self.tw.term.type == 'survival') {
		// survival terms have a different discrete UI than numeric terms
		handler.dom.discreteSur_div = div.append('div').style('padding', '4px')
		renderSurvivalDiscreteButton(self)
		return
	}
	handler.dom.num_holder = div
	handler.dom.density_div = div.append('div')
	handler.dom.bins_div = div.append('div').style('padding', '4px')
	setqDefaults(handler)
	setDensityPlot(handler)
	renderBoundaryInclusionInput(handler)
	renderTypeInputs(handler)
	renderButtons(handler)
}

/******************* Functions for Numerical Custom size bins *******************/
function renderCustomBinInputs(handler, tablediv: any) {
	const self = handler.termsetting
	mayShowValueconversionMsg(handler, tablediv)
	handler.dom.bins_table = tablediv.append('div').style('display', 'flex').style('width', '100%')

	// boundaryDiv for entering bin boundaries
	// rangeAndLabelDiv for rendering ranges and labels
	const boundaryDiv = handler.dom.bins_table.append('div').style('margin-right', '20px')
	handler.dom.rangeAndLabelDiv = handler.dom.bins_table.append('div')

	boundaryDiv.append('div').style('margin-bottom', '5px').style('color', 'rgb(136, 136, 136)').text('Bin boundaries')

	handler.dom.customBinBoundaryInput = boundaryDiv
		.append('textarea')
		.style('width', '100px')
		.style('height', '70px')
		.text(
			self.q
				.lst!.slice(1)
				.map(d => d.start)
				.join('\n')
		)
		.on('change', handleChange)
		.on('keyup', async function (this: any, event: any) {
			// enter or backspace/delete
			// i don't think backspace works
			if (!keyupEnter(event) && event.key != 8) return
			if (!handler.dom.bins_table.selectAll('input').node().value) return
			// Fix for if user hits enter with no values. Reverts to default cutoff.
			handleChange.call(this)
		})

	// help note
	boundaryDiv
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.html('Enter numeric values </br>seperated by ENTER')

	function handleChange() {
		const inputs = handler.dom.bins_table.selectAll('input')
		inputs.property('value', '')
		const data = processCustomBinInputs(handler)
		if (data == undefined) {
			// alert('Enter custom bin value(s)')
			return
		}
		// update self.q.lst and render bin lines only if bin boundry changed
		const q = self.numqByTermIdModeType[self.term.id].discrete[self.q.type!]
		if (self.q.hiddenValues!) q.hiddenValues = self.q.hiddenValues!
		if (binsChanged(data, q.lst)) {
			q.lst = data
			self.renderBinLines!(handler, q)
		}
		renderBoundaryInputDivs(handler, q.lst)
		self.q.lst = q.lst //store the new ranges in self.q, the mode is initialized when selecting the tab
	}

	function binsChanged(data, qlst) {
		if (data.length != qlst.length) return true
		if (Object.keys(data[0]).length !== Object.keys(qlst[0]).length) return true
		for (const [i, bin] of qlst.entries()) {
			for (const k of Object.keys(bin)) {
				if (bin[k] && bin[k] !== data[i][k]) {
					return true
				}
			}
		}
		return false
	}

	renderBoundaryInputDivs(handler, self.q.lst)

	// add help message for custom bin labels
}

export function renderBoundaryInputDivs(handler, data: any) {
	const holder = handler.dom.rangeAndLabelDiv
	holder.selectAll('*').remove()

	const grid = holder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'auto auto')
		.style('column-gap', '20px')
		.style('align-items', 'center')

	grid.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Range')

	grid.append('div').style('margin-bottom', '3px').style('color', 'rgb(136, 136, 136)').text('Bin label')

	for (const [i, d] of data.entries()) {
		grid.append('div').attr('name', 'range').html(d.range)

		grid
			.append('div')
			.append('input')
			.attr('type', 'text')
			.style('margin', '2px 0px')
			.property('value', d.label)
			.on('change', function (this: any) {
				data[i].label = this.value
			})
	}

	handler.dom.customBinRanges = handler.dom.bins_table.selectAll('div[name="range"]').data(data)
	handler.dom.customBinLabelInput = handler.dom.bins_table.selectAll('input').data(data)
}

function renderButtons(handler) {
	const self = handler.termsetting
	const btndiv = handler.dom.bins_div.append('div')
	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Apply')
		.on('click', () => applyEdits(self))
	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Reset')
		.on('click', () => {
			// delete self.q
			self.q = {}
			delete self.numqByTermIdModeType[self.term.id]
			showBinsMenu(handler, handler.dom.num_holder)
		})
}

function renderSurvivalDiscreteButton(handler) {
	const self = handler.termsetting
	const noteDiv = handler.dom.discreteSur_div.append('div')

	noteDiv.append('div').style('font-size', '.8em').style('margin', '5px').html(`
			Display survival outcomes as exit codes <br>
		`)
	const btndiv = handler.dom.discreteSur_div.append('div')
	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Apply')
		.on('click', () => applyEdits(self))
}
