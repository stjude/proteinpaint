import { event as d3event } from 'd3-selection'
import { setDensityPlot } from './termsetting.density'
import { renderBoundaryInclusionInput, renderBoundaryInputDivs } from './termsetting.discrete'
import { get_bin_label } from '../../shared/termdb.bins'
import { keyupEnter } from '../client'

export async function setNumericMethods(self, closureType = 'closured') {

	if (closureType == 'non-closured') {
		// TODO: always use this non-closured version later
		return {
			get_term_name,
			get_status_msg,
			showEditMenu
		}
	} else {
		// this version maintains a closured reference to 'self'
		// so the 'self' argument does not need to be passed
		//
		// TODO: may convert all other termsetting.*.js methods to
		// just use the non-closured version to simplify
		//
		(self.get_term_name = d => get_term_name(self, d)),
			(self.get_status_msg = get_status_msg),
			(self.showEditMenu = async div => await showEditMenu(self, div))
	}
}

function get_term_name(self, d) {
	if (!self.opts.abbrCutoff) return d.name
	return d.name.length <= self.opts.abbrCutoff + 2
		? d.name
		: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
}

function get_status_msg() {
	return ''
}

async function showEditMenu(self, div) {

    if (!self.numqByTermIdType) self.numqByTermIdType = {}
	self.num_obj = {}

	self.num_obj.plot_size = {
		width: 500,
		height: 100,
		xpad: 10,
		ypad: 20
	}
	try {
		// check if termsettingInit() was called outside of termdb/app
		// in which case it will not have an opts.vocabApi
		if (!self.opts.vocabApi) {
			const vocabulary = await import('../termdb/vocabulary')
			self.opts.vocabApi = vocabulary.vocabInit({ state: { vocab: self.opts.vocab } })
		}
		self.num_obj.density_data = await self.opts.vocabApi.getDensityPlotData(self.term.id, self.num_obj, self.filter)
		self.num_obj.median = self.q && self.q.lst && self.q.lst.length ? self.q.lst[0].stop : undefined
		console.log(self)
	} catch (err) {
		console.log(err)
	}

	div.selectAll('*').remove()
	self.dom.num_holder = div.append('div')
    self.dom.bins_div = div.append('div').style('padding', '5px')

    setqDefaults(self)
	setDensityPlot(self)
    renderBoundaryInclusionInput(self)

    // cutoff input
    self.dom.cutoff_div = self.dom.bins_div.append('div').style('margin', '5px')
    renderCuttoffInput(self)

    // render bin labels
    self.dom.bins_div.append('div')
        .style('padding', '5px')
        .style('margin', '5px')
        .style('color', 'rgb(136, 136, 136)')
        .html('Bin labels')
    self.dom.customBinLabelTd = self.dom.bins_div.append('div')
        .style('padding', '5px')
        .style('margin', '5px')
    renderBoundaryInputDivs(self, self.q.lst)

	const btndiv = div.append('div').style('padding', '3px 10px')

	btndiv
		.append('button')
		.style('margin', '5px')
		.html('Apply')
		.on('click', async () => {
			self.q.mode = 'binary'
			self.opts.callback({
				id: self.term.id,
				term: self.term,
				q: self.q
			})
		})

	btndiv.append('button')
		.style('margin', '5px')
		.html('Reset')
		.on('click', () => {
            // TODO: set self.q to default
			// self.q.mode = 'binary'
			// self.opts.callback({
			// 	term: self.term,
			// 	q: self.q
			// })
		})
}

function setqDefaults(self) {
	console.log(self.q )
	const dd = self.num_obj.density_data
	const median = self.q && self.q.lst && self.q.lst.length ? self.q.lst[0].stop : undefined
	if (!(self.term.id in self.numqByTermIdType)) {
		const cutoff = median !== undefined
            ? median
            : (dd.maxvalue != dd.minvalue)
            ? dd.minvalue + (dd.maxvalue - dd.minvalue) / 2 
            : dd.maxvalue

		self.numqByTermIdType[self.term.id] = {
			custom:
				self.q && self.q.type == 'custom'
					? self.q
					: {
							type: 'custom',
							lst: [
								{
									startunbounded: true,
									stopinclusive: true,
									stop: +cutoff.toFixed(self.term.type == 'integer' ? 0 : 2)
								},
								{
									stopunbounded: true,
									stopinclusive: true,
									start: +cutoff.toFixed(self.term.type == 'integer' ? 0 : 2)
								}
							]
					  }
		}
		if (!self.numqByTermIdType[self.term.id].custom.type) {
			self.numqByTermIdType[self.term.id].custom.type = 'custom'
		}
	} else if (self.term.q) {
		if (!self.term.q.type) throw `missing numeric term q.type: should be 'regular' or 'custom'`
		self.numqByTermIdType[self.term.id][self.q.type] = self.q
	}

	//if (self.q && self.q.type && Object.keys(self.q).length>1) return
	if (!self.q) self.q = {}
	self.q.type = 'custom'
	self.q = JSON.parse(JSON.stringify(self.numqByTermIdType[self.term.id][self.q.type]))
	if (self.q.lst) {
		self.q.lst.forEach(bin => {
			if (!('label' in bin)) bin.label = get_bin_label(bin, self.q)
		})
	}
	//*** validate self.q ***//
}

function renderCuttoffInput(self) {

    self.dom.cutoff_div.append('div')
        .style('display','inline-block')
        .style('padding', '5px')
        .style('color', 'rgb(136, 136, 136)')
        .html('Boundary value')

    self.dom.customBinBoundaryInput = self.dom.cutoff_div
        .append('input')
        .style('width', '100px')
        .attr('type', 'number')
        .attr('value', self.q.lst[0].stop)
        .on('change', handleChange)

        function handleChange() {
            const cutoff = +this.value
            self.q.lst[0].stop = cutoff
            self.q.lst[1].start = cutoff
            self.q.lst.forEach(bin => {
                bin.label = get_bin_label(bin, self.q)
            })
            setDensityPlot(self)
            renderBoundaryInputDivs(self, self.q.lst)
        }
}
