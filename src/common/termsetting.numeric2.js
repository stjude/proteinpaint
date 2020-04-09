import * as client from '../client'
import { select, event } from 'd3-selection'
import { setDensityPlot } from './termsetting.density'


/*
Arguments
self: a termsetting instance
*/

const tsInstanceTracker = new WeakMap()
let i=0

export async function setNumericMethods(self) {
	if (!tsInstanceTracker.has(self)) {
		tsInstanceTracker.set(self, i++)
	}

	self.term_name_gen = function(d) {
		return d.name.length <= 25
			? d.name
			: '<label title="' + d.name + '">' + d.name.substring(0, 24) + '...' + '</label>'
	}

	self.get_status_msg = () => ''

	self.showEditMenu = async function(div) {
		if (!self.numqByTermIdType) self.numqByTermIdType = {}
		self.num_obj = {}

		self.num_obj.plot_size = {
			width: 500,
			height: 100,
			xpad: 10,
			ypad: 20
		}
		try {
			self.num_obj.density_data = await getDensityPlotData(self); console.log(38, self.num_obj.density_data)
		} catch (err) {
			console.log(err)
		}

		div.selectAll('*').remove()
		self.dom.num_holder = div
		self.dom.bins_div = div.append('div').style('padding', '5px')

		setqDefaults(self)
		//setDensityPlot(self)
		renderBoundaryInclusionInput(self)
		renderTypeInputs(self)
		if (self.q.type == 'regular') renderFixedBinsInputs(self)
		else renderCustomBinInputs(self)
		renderButtons(self)
	}

	self.applyEdits = function() {
		const startinclusive = self.dom.boundaryInput.property('value') == 'startinclusive'
		const stopinclusive = self.dom.boundaryInput.property('value') == 'stopinclusive'

		if (self.q.type == 'regular') {
			self.q.first_bin.startunbounded = true
			self.q.bin_size = +self.dom.bin_size_input.property('value')
			self.q.first_bin.stop = +self.dom.first_stop_input.property('value')
			self.q.startinclusive = startinclusive
			self.q.stopinclusive = stopinclusive

			if (self.dom.last_radio_auto.property('checked')) {
				delete self.q.last_bin
			} else {
				if (!self.q.last_bin) self.q.last_bin = {}
				self.q.last_bin.start = +self.dom.last_start_input.property('value')
				self.q.last_bin.stopunbounded = true
			}

			self.numqByTermIdType[self.term.id].regular = JSON.parse(JSON.stringify(self.q))
		} else {
			delete self.q.startinclusive
			delete self.q.stopinclusive
			delete self.q.bin_size
			delete self.q.first_bin
			delete self.q.last_bin

			const bins = [...self.dom.customBintbody.node().querySelectorAll('tr')]
			let prevBin
			self.q.lst = bins.map((row,i) => {
				const bin = {
					startinclusive,
					stopinclusive,
				}

				if (i === 0) {
					bin.startunbounded = true
				} else {
					prevBin.stop = +row.firstChild.firstChild.value
					bin.start = prevBin.stop
				}

				prevBin = bin
				return bin
			})
			prevBin.stopunbounded = true
			self.numqByTermIdType[self.term.id].custom = JSON.parse(JSON.stringify(self.q))
		} console.log(103, self.q)

		self.opts.callback({
			term: self.term,
			q: self.q
		})
	} 
}

async function getDensityPlotData(self) {
	let density_q =
		'/termdb?density=1' +
		'&genome=' +
		self.opts.genome +
		'&dslabel=' +
		self.opts.dslabel +
		'&termid=' +
		self.term.id +
		'&width=' +
		self.num_obj.plot_size.width +
		'&height=' +
		self.num_obj.plot_size.height +
		'&xpad=' +
		self.num_obj.plot_size.xpad +
		'&ypad=' +
		self.num_obj.plot_size.ypad

	if (typeof self.filter != 'undefined') {
		density_q = density_q + '&filter=' + encodeURIComponent(JSON.stringify(self.filter))
	}
	const density_data = await client.dofetch2(density_q)
	if (density_data.error) throw density_data.error
	return density_data
}

function setqDefaults(self) {
	//const filterStr = JSON.stringify(self.term.q)
	if (!(self.term.id in self.numqByTermIdType) /*|| self.numqByTermIdType[self.term.id].filterStr != filterStr*/) {
		self.numqByTermIdType[self.term.id] = {
			//filterStr,
			regular: self.opts.use_bins_less && self.term.bins.less ? self.term.bins.less : self.term.bins.default,
			custom: self.q && self.q.type == 'custom'
				? self.q
				: {
						type: 'custom',
						lst: [{
							startunbounded: true,
							stopinclusive: true,
							stop: self.num_obj.density_data.maxvalue != self.num_obj.density_data.minvalue
								? self.num_obj.density_data.maxvalue + (self.num_obj.density_data.maxvalue - self.num_obj.density_data.minvalue)/2
								: self.num_obj.density_data.maxvalue
						}]
					}
		}
		if (!self.numqByTermIdType[self.term.id].regular.type) {
			self.numqByTermIdType[self.term.id].regular.type = 'regular'
		}
	}

	//if (self.q && self.q.type && Object.keys(self.q).length>1) return
	if (!self.q) self.q = {}
	if (!self.q.type) self.q.type = 'regular'
	self.q = JSON.parse(JSON.stringify(self.numqByTermIdType[self.term.id][self.q.type]))
	//*** validate self.q ***//
}

function renderBoundaryInclusionInput(self) {
	self.dom.boundaryInclusionDiv = self.dom.bins_div.append('div').style('margin-left', '5px')
	
	self.dom.boundaryInclusionDiv.append('span')
		.style('padding', '5px')
		.html('Boundary Inclusion')

	const x = '<span style="font-family:Times;font-style:italic">x</span>'

	self.dom.boundaryInput = self.dom.boundaryInclusionDiv.append('select').style('margin-left', '10px')

	self.dom.boundaryInput
		.selectAll('option')
		.data([
			{value: 'stopinclusive', html: 'start &lt; ' + x + ' &le; end'},
			{value: 'startinclusive', html: 'start &le; ' + x + ' &lt; end'}
		])
		.enter().append('option')
		.property('value', d=>d.value)
		.property('selected', d => self.q[d.value] == true)
		.html(d=>d.html)
}

function renderTypeInputs(self) {
	const id = tsInstanceTracker.get(self)
	const div = self.dom.bins_div.append('div').style('margin', '10px')
	//div.append('span').html('Bin Size:')
	const l1 = div.append('label').style('margin-right', '15px')
	l1.append('input')
		.attr('type', 'radio')
		.attr('name', 'bins_type_'+id)
		.attr('value', 'regular')
		.property('checked', self.q.type == 'regular')
		.style('margin-right', '3px')
		.style('vertical-align', 'top')
		.on('change', function() {
			self.q.type = this.checked ? 'regular' : 'custom'
			self.showEditMenu(self.dom.num_holder)
		})
	l1.append('span').html('Use same bin size')
	
	const l2 = div.append('label')
	l2.append('input')
		.attr('type', 'radio')
		.attr('name', 'bins_type_'+id)
		.attr('value', 'custom')
		.property('checked', self.q.type == 'custom')
		.style('margin-right', '3px')
		.style('vertical-align', 'top')
		.on('change', function() {
			self.q.type = this.checked ? 'custom'	: 'regular'
			self.showEditMenu(self.dom.num_holder)
		})
	l2.append('span').html('Use varying bin sizes')
}

/******************* Functions for Numerical Fixed size bins *******************/
function renderFixedBinsInputs(self) {
	const tablediv = self.dom.bins_div.append('div').style('border', '1px solid #ccc').style('margin', '10px').style('padding', '5px')
	self.dom.bins_table = tablediv.append('table')
	renderBinSizeInput(self, self.dom.bins_table.append('tr'))
	renderFirstBinInput(self, self.dom.bins_table.append('tr'))
	renderLastBinInputs(self, self.dom.bins_table.append('tr'))
}

function renderBinSizeInput(self, tr) {
	tr.append('td')
		.style('margin', '5px')
		.html('Bin Size')

	self.dom.bin_size_input = tr.append('td')
		.append('input')
		.attr('type', 'number')
		.attr('value', self.q.bin_size)
		.style('color', '#cc0000')
		.style('margin-left', '15px')
		.style('width', '100px')
		.on('keyup', () => {
			
		})
	
	tr.append('td')
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.text('Red lines indicate bins automatically generated based on this value.')
}

function renderFirstBinInput(self, tr) {
	//const brush = self.num_obj.brushes[0]
	if (!self.q.first_bin) self.q.first_bin = {}
	tr
		.append('td')
		.style('margin', '5px')
		.html('First Bin Stop')

	self.dom.first_stop_input = tr.append('td')
		.append('input')
		.attr('type', 'number')
		.property('value', 'stop' in self.q.first_bin ? self.q.first_bin.stop : '')
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('keyup', async () => {
			if (!client.keyupEnter()) return
			//brush.input.property('disabled', true)
			try {
				//update_first_bin(self, brush)
			} catch (e) {
				window.alert(e)
			}
			//brush.input.property('disabled', false)
		})

	//if (isFinite(self.q.first_bin.stop)) {
		//brush.input.attr('value', parseFloat(self.q.first_bin.stop))
	//}

	tr.append('td')
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('color', '#858585')
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.html('<b>Left</b>-side gray box indicates the first bin. <br> Drag to change its size.')
}

function renderLastBinInputs(self, tr) {
	const id = tsInstanceTracker.get(self)
	const isAuto = !self.q.last_bin || Object.keys(self.q.last_bin).length === 0

	tr.append('td')
		.style('margin', '5px')
		.html('Last Bin Start')

	const td1 = tr.append('td').style('padding-left', '15px').style('vertical-align', 'top')
	const radio_div = td1.append('div')
	const label0 = radio_div
		.append('label')
		.style('padding-left', '10px')
		.style('padding-right', '10px')

	self.dom.last_radio_auto = label0
		.append('input')
		.attr('type', 'radio')
		.attr('name', 'last_bin_opt_' + id)
		.attr('value', 'auto')
		.style('margin-right', '3px')
		.property('checked', isAuto)
		.on('change', function() {
			if (this.checked) {
				delete self.q.last_bin
				edit_div.style('display', 'none')
			}
			else {
				if (!self.q.last_bin) self.q.last_bin = {}
				self.q.last_bin.start = edit_input.property('value')
				edit_div.style('display', 'inline-block')
			}
		})

	label0.append('span').html('Automatic<br>')

	const label1 = radio_div
		.append('label')
		.style('padding-left', '10px')
		.style('padding-right', '10px')

	label1
		.append('input')
		.attr('type', 'radio')
		.attr('name', 'last_bin_opt_' + id)
		.attr('value', 'auto')
		.style('margin-right', '3px')
		.property('checked', !isAuto)
		.on('change', function() {
			if (!this.checked) {
				delete self.q.last_bin.start
				edit_div.style('display', 'none')
			}
			else {
				if (!self.q.last_bin) self.q.last_bin = {}
				self.q.last_bin.start = self.dom.last_start_input.property('value')
				edit_div.style('display', 'inline-block')
			}
		})

	label1.append('span').html('Fixed')

	const edit_div = tr.append('td').append('div').style('display', isAuto ? 'none' : 'inline-block')
	self.dom.last_start_input = edit_div
		.append('input')
		.attr('type', 'number')
		.style('width', '100px')
		.style('margin-left', '15px')
		.on('keyup', async () => {
			//if (this.checked) self.q.last_bin.start = 
			//else delete self.q.last_bin.start
		})

	// note div
	tr.append('td')
		.style('display', 'none')
		.append('div')
		.style('font-size', '.6em')
		.style('margin-left', '1px')
		.style('padding-top', '30px')
		.style('color', '#858585')
		.style('display', self.num_obj.no_density_data ? 'none' : 'block')
		.html('<b>Right</b>-side gray box indicates the last bin. <br> Drag to change its size.')
}

/******************* Functions for Numerical Custom size bins *******************/
function renderCustomBinInputs(self) {
	const tablediv = self.dom.bins_div.append('div').style('border', '1px solid #ccc').style('margin', '10px').style('padding', '5px')
	self.dom.bins_table = tablediv.append('table')
	const thead = self.dom.bins_table.append('thead').append('tr')
	thead.append('th').html('Bin Boundary')
	thead.append('th').html('Bin Label')
	const removeth = thead.append('th').html('Remove')
	self.dom.customBintbody = self.dom.bins_table.append('tbody')
	appendBoundaryTr(self, self.q.lst[0])
	
	self.dom.customBintbody.selectAll('.bin-boundary-input')
		.data(self.q.lst.slice(1))
		.enter().append('tr')
		.attr('class', 'bin-boundary-input')
		.each(function(d){
			appendBoundaryTr(self, d, select(this))
		})

	removeth.style('display', self.dom.customBintbody.selectAll('tr').size() < 3 ? 'none' : '')

	tablediv
		.append('div')
		.style('width', '100%')
		.style('text-align', 'right')
		.append('button')
		.html('+Boundary')
		.style('margin', '5px')
		.on('click', ()=>{
			appendBoundaryTr(self, '', self.dom.customBintbody.append('tr'))
			const numRows = self.dom.customBintbody.selectAll('tr').size()
			self.dom.bins_table.selectAll('tr').selectAll('td:nth-child(3), th:nth-child(3)').style('display', numRows < 3 ? 'none' : '')
		})
}

function appendBoundaryTr(self, d, _tr) {
	const tr = !_tr ? self.dom.customBintbody.append('tr') : _tr
	if (!_tr) tr.append('td')
	else tr.append('td').append('input').attr('type', 'number').property('value', d.start).style('margin-top', '-20px')

	tr.append('td').append('input').attr('type', 'text').property('value', d.label)
		
	if (_tr) {
		tr.append('td')
			.style('display', self.dom.customBintbody.selectAll('tr').size() < 3 ? 'none' : 'table-cell')
			.style('text-align', 'center')
			.append('button')
			.style('margin-top', '-20px')
			.html('x')
			.on("click", ()=>{
				tr.remove()
				const numRows = self.dom.customBintbody.selectAll('tr').size()
				self.dom.bins_table.selectAll('tr').selectAll('td:nth-child(3), th:nth-child(3)').style('display', numRows < 3 ? 'none' : '')
			})
	}
}

function renderButtons(self) {
	const btndiv = self.dom.bins_div.append('div')
	btndiv.append('button').style('margin', '5px').html('Apply').on('click', self.applyEdits)
	btndiv.append('button').style('margin', '5px').html('Reset').on('click', ()=>{
		delete self.numqByTermIdType[self.term.id]
		self.showEditMenu(self.dom.num_holder)
	})
}

