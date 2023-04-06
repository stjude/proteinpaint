import { select as d3select } from 'd3-selection'
import settings from './settings'
import templatecontrols from './template.controls'

/*

This renders a control panel that is
meant to be used by the pg.disco application.

*/

export class DtDiscoControls {
	constructor(ch) {
		// should do this in pg.disco
		ch.err = errHandler()

		ch.dom.holder
			.attr('class', 'pp-chord-controls-holder')
			//.style('position','absolute')
			.style('top', 0)
			.style('left', 0)
			.style('display', 'block')
		//.style('height','700px')
		//.style('vertical-align','top')

		const row1 = ch.dom.holder.append('div').style('margin-bottom', '5px')
		addSettingsMenu(row1, ch)
		addDataMenu(row1, ch)
		addUndoRedo(row1, ch)
		//addInput(row1,ch)
	}
}

function addSettingsMenu(row1, ch) {
	row1
		.append('button')
		.attr('id', 'pp-chord-btn-settings')
		.text('Settings')
		.on('mousedown.ppchordsettings', () => {
			settingsMenu.sync()
		})

	const opts = {
		elem: document.getElementById('pp-chord-btn-settings'),
		conf: ch.getState(ch.key),
		options: settings,
		changeHandler: function() {
			opts.conf = ch.getState(ch.key)
			ch.dispatch(settingsMenu.getVals(), ch.key)
		}
	}

	const settingsMenu = templatecontrols(opts)
}

function addDataMenu(row1, ch) {
	let dataBtnClicked

	// Data
	const dataBtn = row1
		.append('button')
		.attr('id', 'pp-chord-btn-download')
		.text('Data')
		.on('click.tpchorddata', () => {
			dataDiv.showunder(dataBtn.node())
			dataDiv.show()
			schemadiv.showunder(dataBtn.node())
			schemadiv.d.style('display', 'none')
		})
	const dataDiv = new client.Menu({
		openedBy: dataBtn.node(),
		padding: '5px',
		holder: ch.dom.holder
	})
	dataDiv.showunder(dataBtn.node())
	dataDiv.d
		.style('border', '1px solid #aaa')
		.style('display', 'none')
		.style('z-index', 1001)

	// Uploads
	if (ch.settings.showUpload) {
		const UploadDiv = dataDiv.d.append('div')
		UploadDiv.append('h5')
			.html('Upload Project')
			.style('padding', '2px')
			.style('margin', '2px')

		ch.refNameInput = dataDiv.d
			.append('input')
			.attr('type', 'text')
			.property('value', 'ref.txt')
			.style('width', '100px')
			.style('margin-right', '20px')
			.style('padding-left', '7px')

		const buttlabel = dataDiv.d
			.append('label')
			.attr('for', 'sjcharts-project-btn')
			.attr('class', 'sja_btn')
			.style('padding', '3px 5px')
			.html('Choose folder')

		const butt = dataDiv.d
			.append('input')
			.attr('type', 'file')
			.attr('id', 'sjcharts-project-btn')
			.property('multiple', true)
			.property('webkitdirectory', true)
			.property('directory', true)
			.style('width', '0')
			.style('height', '0')
			.on('change', () => ch.eventFxns.fileLoaded(ch))
	}

	// Downloads
	const downloadDiv = dataDiv.d.append('div')
	downloadDiv
		.append('h5')
		.html('Downloads')
		.style('padding', '2px')
		.style('margin', '2px')
	downloadDiv
		.append('button')
		.attr('title', 'Download an SVG image file of this chart.')
		//.style('width','100%')
		.text('SVG')
		.on('click', () => {
			const resizeBtn = ch.dom.svg.select('.pp-chord-resize-btn').style('display', 'none')
			const svg = ch.dom.svg.node()
			const styles = window.getComputedStyle(svg)
			for (const s of styles) {
				ch.dom.svg.style(s, styles.getPropertyValue(s))
			}

			client.to_svg(svg, 'disco')
			resizeBtn.style('display', '')
		})
	downloadDiv
		.append('button')
		.attr('title', 'Download a JSON file to recreate this chart.')
		//.style('width','100%')
		.text('Full JSON')
		.on('click', () => {
			const a = document.createElement('a')
			document.body.appendChild(a)
			a.addEventListener(
				'click',
				function() {
					a.download = 'disco-full.json'
					let content = {
						settings: ch.getState(ch.key),
						data: ch.currData
					}
					content = JSON.stringify(content, null, 2)
					a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		})

	downloadDiv
		.append('button')
		.attr('title', 'Download a JSON array of the data')
		//.style('width','100%')
		.text('Data')
		.on('click', () => {
			const a = document.createElement('a')
			document.body.appendChild(a)
			a.addEventListener(
				'click',
				function() {
					a.download = 'disco-data.json'
					let content = JSON.stringify(ch.currData, null, 2)
					a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		})

	/*
	const TsvInputDiv=downloadDiv.append('div')
	TsvInputDiv.append('h5')
		.html('Text Input')
		.style('padding','2px')
		.style('margin','2px')

	const colsBtn = TsvInputDiv.append('button')
		.text('Connections')
		.on('click',()=>{
			dataBtnClicked='connections'
			schemaTitle.html('from to value [from_parent to_parent] (\\newline) ...')
			schemata.attr('placeholder','a\tb\t3\n')
			const s=ch.getState(ch.key); console.log(flowsToTsv(ch.data))
			schemata.property('value',flowsToTsv(ch.data))
			dataDiv.hide()
			schemadiv.showunder(dataBtn.node())
			schemadiv.show()
		})
	*/

	/*
	const ExamplesDiv=downloadDiv.d.append('div')
	ExamplesDiv.append('h5')
		.html('Examples')
		.style('padding','2px')
		.style('margin','2px')

	const examplesSelect = ExamplesDiv.append('select')
		
	examplesSelect.selectAll('option')
		.data(Object.keys(ch.examples))
	.enter().append('option')
		.attr('value',d=>d)
		.html(d=>d)
		
	examplesSelect.on('change',function(d){
		window.location.hash = "#"+this.value
		// ch.dispatch({dataName:this.value},ch.key)
	})
	*/

	const schemadiv = new client.Menu({ padding: '5px' })
	schemadiv.showunder(dataBtn.node())
	schemadiv.d.style('display', 'none')

	const schemaTop = schemadiv.d.append('div')
	const schemaTitle = schemaTop.append('span')
	schemaTop
		.append('button')
		.text('update')
		.style('float', 'right')
		.on('click', () => {
			const subState =
				dataBtnClicked == 'connections'
					? { flows: tsvToFlows(schemata), exampleName: new Date().toString(), updateddata: true }
					: {}
			ch.dispatch(subState, ch.key, 'data')
		})

	const schemata = schemadiv.d
		.append('textarea')
		.attr('cols', 41)
		.attr('rows', 25)
		.attr('placeholder', 'grp1\ttp53\ngrp1\tnras\ngrp2\tflt3\n')
		.style('resize', 'both')
		.style('font-family', 'Courier')
		.on('keydown', () => {
			// handle tab key within textarea
			const keyCode = event.keyCode || event.which
			if (keyCode == 9) {
				event.preventDefault()
				const self = event.target
				const s = self.selectionStart
				self.value = self.value.substring(0, self.selectionStart) + '\t' + self.value.substring(self.selectionEnd)
				self.selectionEnd = s + 1
			}
		})

	const advancedDiv = dataDiv.d.append('div')
	advancedDiv
		.append('h5')
		.html('Advanced')
		.style('padding', '2px')
		.style('margin', '2px')
	const schemaBtn = advancedDiv
		.append('button')
		.text('Schema')
		.on('click', () => {
			dataBtnClicked = 'schema'
			schemata.property('value', JSON.stringify(ch.getState(ch.key), null, 2))
			dataDiv.hide()
			schemadiv.show()
			schemaTop.style('display', '')
		})

	advancedDiv
		.append('button')
		.text('Patient Counts')
		.on('click', () => {
			schemaTop.style('display', 'none')
			dataBtnClicked = 'patientCnt'

			const textArr = []
			for (const gene in ch.patientsByGene) {
				textArr.push([gene, ch.patientsByGene[gene].length])
			}
			textArr.sort((a, b) => {
				return a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0
			})
			const text = textArr.map(d => d.join('\t')).join('\n')

			schemata.property('value', text)
			dataDiv.hide()
			schemadiv.show()
		})
}

// allowed schema names
const schemaNames = ['discoJSON']

// allowed data file types
const typeIndex = {
	snvindel: 'snvindel',
	cnv: 'cnv',
	fusion: 'svjson',
	svjson: 'svjson'
}

function readFiles(ch) {
	const self = ch
	const refFileName = ch.refNameInput.property('value')
	const files = Array.from(d3event.target.files)
	const ref = files.filter(f => f.name == refFileName)[0]

	if (!ref && ch.err) {
		ch.err("Missing reference file='" + refFileName + "'.")
		return
	}

	const fileNameToType = {}
	const nameToSchemaType = {}
	const data = { schema: {}, files: [], expectedFileNames: [] }
	const reader = new FileReader()
	let schemaFileName = ''
	let numProcessedFiles = 0

	reader.onload = event => {
		// process reference file
		event.target.result
			.trim()
			.split('\n')
			.forEach(line => {
				console.log(line)
				const [type, filename] = line.split('\t')
				console.log(type, filename)
				if (schemaNames.includes(type)) {
					nameToSchemaType[filename] = type
				} else if (!typeIndex[type] && typeIndex[type] !== 0) {
					ch.err('Unrecognized type ' + type + ' for file ' + filename + ' in reference.txt.')
				} else {
					fileNameToType[filename] = typeIndex[type]
				}
			})

		// track the expected files to processed by filename
		data.expectedFileNames = Object.keys(fileNameToType)

		// get schemas next
		const schemaFiles = files.filter(file => file.name in nameToSchemaType)
		let numProcessedSchemas = 0
		console.log(schemaFiles)
		schemaFiles.forEach(file => {
			const reader = new FileReader()
			reader.onload = event => {
				const schema = JSON.parse(event.target.result)
				numProcessedSchemas += 1
				if (!schema) {
					ch.err('Unable to parse schema file="' + file.name + '".')
				} else {
					data.schema[nameToSchemaType[file.name]] = schema
				}
				if (numProcessedSchemas == schemaFiles.length) {
					files.forEach(processFile)
				}
			}
			reader.onerror = () => {
				ch.err('Error reading schema.txt.')
			}
			reader.readAsText(file, 'utf8')
		})

		function processFile(file) {
			if (!data.expectedFileNames.includes(file.name)) {
				numProcessedFiles += 1
				return
			}
			if (!file) {
				ch.err('Error reading file.')
				numProcessedFiles += 1
				return
			}
			if (file.size == 0) {
				ch.err('Wrong file: ' + file.name)
				numProcessedFiles += 1
				return
			}
			if (!fileNameToType[file.name] && fileNameToType[file.name] !== 0 && file.name != schemaFileName) {
				ch.err('Missing or invalid type assigned to file ' + file.name + '.')
				numProcessedFiles += 1
				return
			}
			const reader = new FileReader()

			reader.onload = event => {
				numProcessedFiles += 1
				data.files.push({
					name: file.name,
					type: fileNameToType[file.name],
					rows: textToArrays(event.target.result)
				})
				if (numProcessedFiles == files.length) {
					ch.processData(data)
				}
			}
			reader.onerror = () => {
				numProcessedFiles += 1
				ch.err('Error reading file ' + file.name)
				if (numProcessedFiles == files.length) {
					ch.processData(data)
				}
			}
			reader.readAsText(file, 'utf8')
		}
	}
	reader.onerror = () => {
		ch.err('Error reading reference.txt.')
	}
	reader.readAsText(ref, 'utf8')
}

function groupToTsv(group) {
	if (!group) return ''
	const lines = []
	group.forEach(grp => {
		grp.lst.map(g => {
			lines.push(grp.name + '\t' + g.name)
		})
	})
	return lines.join('\n')
}

function tsvToMatrix(schemata) {
	var indexToName = d3.map(),
		nameToIndex = d3.map(),
		matrix = [],
		n = 0

	var nameToSubdomain = {}
	var indexToSubdomain = {}
	var groups = []

	// get unique names
	var lines = []
	var emptyRow = []
	var textlines = textarea.property('value').split('\n')

	textlines.forEach((line, i) => {
		if (i === 0 || !line.trim()) return
		var v = line.trim().split('\t')
		lines.push(v)
		const from = layer == 'layer2' ? v[3] : v[0]
		if (!groups.includes(from)) {
			groups.push(from)
			nameToSubdomain[from] = +v[3]
		}
		const to = layer == 'layer2' ? v[4] : v[1]
		if (!groups.includes(to)) {
			groups.push(to)
			nameToSubdomain[to] = +v[4]
		}
	})

	groups.sort((a, b) => {
		return nameToSubdomain[a] - nameToSubdomain[b]
	})

	groups.forEach((name, i) => {
		indexToSubdomain[i] = nameToSubdomain[name]
	})

	lines.forEach((v, i) => {
		v[2] = +v[2]
		const from = layer == 'layer2' ? v[3] : v[0]
		if (!nameToIndex.has(from)) {
			var n = groups.indexOf(from)
			indexToName.set(n, from)
			nameToIndex.set(from, n)
			emptyRow.push(0)
		}
		const to = layer == 'layer2' ? v[4] : v[1]
		if (!nameToIndex.has(to)) {
			var n = groups.indexOf(to)
			indexToName.set(n, to)
			nameToIndex.set(to, n)
			emptyRow.push(0)
		}
	})

	// create zero'd matrix
	nameToIndex.forEach(() => {
		matrix.push(emptyRow.slice(0))
	})

	// fill-in matrix with connected values
	const counted = []
	let totalByGrp = { 1: 0, 2: 0, 3: 0, 4: 0 }

	lines.forEach(d => {
		const from = nameToIndex.get(layer == 'layer2' ? d[3] : d[0])
		const to = nameToIndex.get(layer == 'layer2' ? d[4] : d[1])

		/*const trackingName = from <= to ? from+':'+to : to+':'+from
    if (counted.includes(trackingName)) return;
    counted.push(trackingName);*/

		totalByGrp[d[3]] += 1
		totalByGrp[d[4]] += 1

		if (layer == 'layer2') {
			matrix[from][to] += d[2]
			// make chord endpoints equal in value
			matrix[to][from] += d[2]
		} else {
			matrix[from][to] = d[2]
			// make chord endpoints equal in value
			matrix[to][from] = d[2]
		}
	})

	return {
		matrix: matrix
	}
}

function flowsToTsv(data) {
	let text = []
	data.flows.forEach(d => {
		text.push(d.join('\t'))
	})
	return text.join('\n')
}

function tsvToFlows(schemata) {
	const flows = []
	schemata
		.property('value')
		.trim()
		.split('\n')
		.forEach(d => {
			flows.push(d.split('\t'))
		})
	return flows
}

function addUndoRedo(row1, ch) {
	row1
		.append('button')
		.text('Undo')
		.on('click', () => {
			ch.goToHistory(-1, ch.key)
		})

	row1
		.append('button')
		.text('Redo')
		.on('click', () => {
			ch.goToHistory(1, ch.key)
		})
}

function textToDataRows(text) {
	const lines = text.trim().split('\n')
	const header = lines[0].split('\t')
	console.log(header)
	const data = []
	lines.forEach((line, i) => {
		if (i == 0) return
		const d = {}
		line.split('\t').forEach((v, j) => (d[header[j]] = v))
		data.push(d)
	})
	return data
}

function textToArrays(text) {
	const lines = text.trim().split('\n')
	const header = lines[0].split('\t')
	console.log(header)
	const rows = []
	lines.forEach((line, i) => {
		if (i == 0) return
		rows.push(line.split('\t'))
	})
	return [header, rows]
}

// function to track and display accumulated error messages
function errHandler() {
	const errdiv = d3select('body').append('div') //.style('display','none');
	let mssg = ''
	return function(m) {
		if (!m) return
		console.log(m)
		//mssg+=m+'<br/>\n'
		client.sayerror(errdiv, m) //mssg);
	}
}

function addInput(row1, ch) {
	let settings

	const searchmatch = new client.Menu({ padding: '5px' })
	//searchmatch.showunder(ch.dom.butt.node())
	searchmatch.d.style('display', 'none').on('click', () => {
		const s = ch.getState(ch.key)
		event.stopPropagation()
		const cls = event.target.className
		if (cls.indexOf('sja_menuoption') == 0) {
			s.updateddata = true
			const d = event.target.__data__
			const i = s.selectedSamples.indexOf(d[0])
			if (i == -1) s.selectedSamples.push(d[0])
			else s.selectedSamples.splice(i, 1)
			searchmatch.hide()
			searchmatch.d.selectAll('div').remove()
			searchinput.property('value', '')
			ch.dispatch({ selectedSamples: s.selectedSamples }, ch.key)
		}
	})

	let searchinput = row1
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'add/remove samples ...')
		.style('width', '150px')
		.style('margin', '0 5px')
		.on('click', () => {
			event.stopPropagation()
			//if (searchmatch) searchmatch.toggle()
		})
		.on('input', () => {
			settings = ch.getState(ch.key)
			const val = event.target.value.toUpperCase()
			if (!val || val.length < 2) searchmatch.hide()
			else {
				let i
				const matches = [[], [], [], []]
				for (const sample of ch.rows.sampleNames) {
					if (sample == val) matches[0].push([sample])
					else {
						i = ('' + sample).indexOf(val)
						if (i == 0) matches[1].push([sample])
						else if (i != -1) matches[2].push([sample])
					}
				}

				let items = []
				matches.map((arr, i) => {
					arr.sort(searchresultsort)
					arr.map(d => {
						if (items.length < 31) items.push(d)
					})
				})
				if (!items.length) searchmatch.hide()
				else {
					searchmatch.d.selectAll('div').remove()
					searchmatch.showunder(searchinput.node())
					searchmatch.show()
					searchmatch.d
						.style('z-index', 9999)
						.selectAll('div')
						.data(items)
						.enter()
						.append('div')
						.attr('class', d => {
							return d[1] == 'pathway' ? 'sja_menuoption' : 'sja_menuoption_y'
						})
						.html(searchitemhtml)
				}
			}
		})
		.on('blur', () => {
			//searchmatch.d.style('display','none')
		})

	function searchresultsort(a, b) {
		return a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : a[0] < b[0] ? -1 : 1
	}

	function searchitemhtml(d) {
		//const bullet = settings.rows.indexOf(d[0])==-1 ? '' : '&#10006;'
		return d[0]
	}

	function searchitembgcolor(d) {
		return settings.rows.indexOf(d[0]) == -1 ? '#ececec' : ''
	}
}
