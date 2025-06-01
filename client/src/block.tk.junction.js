import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { select as d3select } from 'd3-selection'
import { transition } from 'd3-transition'
import * as client from './client'
import { dofetch3 } from '#common/dofetch'
import * as common from '#shared/common.js'
import * as coord from './coord'
import { legend_newrow } from './block.legend'
//import {tkhandleclick} from './block.tk.menu'
import { rendertk, horiplace, automode } from './block.tk.junction.renderjunctions'

/*
factory:

junctionfromtemplate()
junctionmaketk()
junctionload()

two types of junction track:

1. fixeddata, a given junction-sample matrix, no tabix files and query thereof
2. .tracks[]
   one tabix file per member track
   the list of samples for each track must always be retrieved from tabix track header:
       ensure consistency with the actual data columns
	   allow standalone track to be displayed with 0 config


tk.categories
	show in legend

tk.cohortsetting
	cohort setting to multi sample track
	for block-tracks coming from a server-dataset, the cohort belongs to the dataset
	cohort contains disease group/subgroup hierarchy
	samples from the junction track must have disease annotation for stratify to work
	show in legend


*/

const binpxw = 5 // 5px bins
export const modefold = 1
export const moderaise = 2
export const modesample = 3

const labyspace = 5

function makeTk(tk, block) {
	tk.leftaxis = tk.gleft.append('g')

	let laby = labyspace + block.labelfontsize

	// controller - # junctions
	const thistip = new client.Menu({ padding: 'none' })
	tk.label_mcount = block.maketklefthandle(tk, laby).on('click', event => {
		label_mcount_fillpane(tk, block, thistip)
	})

	laby += labyspace + block.labelfontsize

	tk.totalsamplecount = 0
	tk.height_main = 100

	// no longer shows sample handle: label_samplecount

	// config
	tk.config_handle = block.maketkconfighandle(tk).on('click', event => configpanel(tk, block))

	if (tk.categories || tk.cohortsetting) {
		/*
	will show legend for either categories or cohort setting
	*/
		const [tr, td] = legend_newrow(block, tk.name)
		tk.tr_legend = tr
		tk.td_legend = td
	}

	if (tk.categories) {
		// static
		client.category2legend(tk.categories, tk.td_legend)
	}

	if (tk.cohortsetting) {
		/*
	from dsblocktracklst
	the ds has cohort that governs the sample hierarchy

	initiation will be done once the .headersamples is set
	*/
		tk.cohortsetting.holder = tk.td_legend.append('div').style('margin-top', '10px')
		tk.cohortsetting.legendholder = tk.cohortsetting.holder.append('div')
	}
}

export function junctionload(tk, block) {
	if (tk.uninitialized) {
		makeTk(tk, block)
		delete tk.uninitialized
	}
	if ((block.zoomedin || block.resized) && tk.data) {
		/*
	previously showing junctions, then zoom in, no server request
	*/
		const junc = []
		for (const i of tk.data) {
			const oldx = i.x // must keep old x before zooming in
			const e = j2block(i, block)
			if (e) {
				continue
			}
			if ((i.x0 >= 0 && i.x0 <= block.width) || (i.x1 >= 0 && i.x1 <= block.width)) {
				i.x = oldx
				junc.push(i)
			}
		}
		rendertk(junc, tk, block)
		return
	}

	if (tk.fixeddata) {
		// no server request
		block.tkcloakon(tk)
		const junc2 = []
		for (const j of tk.fixeddata) {
			const j2 = {
				chr: j.chr,
				start: j.start,
				stop: j.stop,
				data: j.data,
				type: j.type
			}
			const e = j2block(j2, block)
			if (e) {
				continue
			}
			junc2.push(j2)
		}

		tk.totalsamplecount = tk.tracks[0].samplecount

		tk.axisheight = 200
		tk.legheight = 50
		tk.bottompad = 0
		tk.qmradius = 2
		tk.lowpad = 15
		tk.padheight = 10

		rendertk(junc2, tk, block)
		return
	}

	if (!tk.tracks) {
		block.tkcloakoff(tk, { error: 'neither .tracks[] or .fixeddata[] are available' })
		tk.height_main = 50
		block.block_setheight()
		return
	}

	// load member files from .tracks[]

	block.block_setheight()
	block.tkcloakon(tk)

	const bincount = Math.ceil(block.width / binpxw)
	let bins = null

	// for progress bar, if more than 1 in .tracks
	let donenum = 0
	const tasks = []
	const allfiledata = []
	for (const t of tk.tracks) {
		const getheader = new Promise((resolve, reject) => {
			if (t.rnapegfile) {
				t.samplecount = 1
				return resolve()
			}
			if (t.samplecount != undefined && t.checkedheader) return resolve()
			/*
		#sample is unknown for this track, try loading header line like a vcf
		t.checkedheader=true to make sure the header will be loaded only once
		this can happen if the file has no header, and do not have data at current view range
		*/
			const par = {}
			if (t.file) {
				par.file = t.file
			} else {
				par.url = t.url
				if (t.indexURL) par.indexURL = t.indexURL
			}
			dofetch3('tabixheader', { body: par }).then(data => {
				if (data.error) return reject('cannot load header for member track ' + t.name + ': ' + data.error)
				t.checkedheader = true
				const str = data.lines.join('')

				/*
			samples should be provided as the comment line but is optional !!
			*/
				if (!str) {
					/*
				no header line
				allow tabix file to have no header line
				if so, when actual junction data is retrieved later, will set t.samplecount by actual # of samples, and the samples/columns remain nameless
				*/
				} else {
					/*
				has header line
				header of a column can be a string of sample name, or a json object to smuggle in structure info, e.g. to go with cohort stratification
				*/

					const l = str.trim().split('\t')
					t.headersamples = []
					for (let i = 5; i < l.length; i++) {
						const str = l[i]

						let j = null // may be parsed into json

						if (str[0] == '{' && str[str.length - 1] == '}') {
							// try parse
							try {
								j = JSON.parse(str)
							} catch (e) {
								console.error('header line field [' + i + '] is broken json: ' + str)
							}
						}
						if (j) {
							// success
							j.tkid = Math.random().toString()
							t.headersamples.push(j)
						} else {
							t.headersamples.push({
								name: l[i],
								tkid: Math.random().toString()
							})
						}
					}
					t.samplecount = t.headersamples.length
					tk.totalsamplecount += t.samplecount
					/*
				if(tk.totalsamplecount>1) {
					tk.label_samplecount.text(tk.totalsamplecount+' samples')
				}
				*/
				}
				resolve()
			})
		})

		const getdata = new Promise((resolve, reject) => {
			getheader
				.then(() => {
					const par = {
						genome: block.genome.name,
						rglst: block.tkarg_maygm(t)
					}
					if (bincount) par.bincount = bincount
					if (t.file || t.rnapegfile) {
						par.file = t.file || t.rnapegfile
					} else {
						par.url = t.url
						if (t.indexURL) par.indexURL = t.indexURL
					}
					if (t.rnapegfile) {
						par.isrnapeg = 1
					}
					dofetch3('junction', { body: par }).then(data => {
						donenum++
						if (tk.tracks.length > 1) {
							block.tkprogress(tk, donenum / tk.tracks.length)
						}
						if (!data) reject('server error for getting member track ' + t.name)
						if (data.error) reject('Cannot get data: ' + data.error)
						if (!data.lst && !data.bins) reject('wrong response when getting data for ' + t.name)
						if (data.lst) {
							// actual junction data retrieved

							if (data.lst[0] && data.lst[0].rawdata && t.samplecount == undefined) {
								/*
						didn't get sample count from tabix header, or no header
						get the count from actual data
						*/
								t.samplecount = data.lst[0].rawdata.length
								tk.totalsamplecount += t.samplecount
								/*
						if(tk.totalsamplecount>1) {
							tk.label_samplecount.text(tk.totalsamplecount+' samples')
						}
						*/
							}

							if (bins) {
								/*
						// current junction data to bin
						// not in use
						var binw=(block.stop-block.start)/bincount
						data.lst.forEach(function(j){
							if(j.start>=block.start && j.start<=block.stop) {
								bins[Math.floor((j.start-block.start)/binw)]+=j.v
							}
							if(j.stop>=block.start && j.stop<=block.stop) {
								bins[Math.floor((j.stop-block.start)/binw)]+=j.v
							}
						})
						*/
							} else {
								const thisfilejunctions = []

								for (const k of data.lst) {
									k.data = []
									for (let i = 0; i < k.rawdata.length; i++) {
										const v = k.rawdata[i]
										if (!Number.isInteger(v) || v <= 0) {
											// invalid read count value
											continue
										}
										const s = { v: v }
										if (t.headersamples) {
											const s0 = t.headersamples[i]
											if (s0) {
												for (const _k in s0) {
													s[_k] = s0[_k]
												}
											}
										} else {
											/*
									no file header
									transfer some attributes
									*/
											if (t.name) s.name = t.name
											if (t.sample) s.sample = t.sample
											if (t.patient) s.patient = t.patient
											if (t.sampeltype) s.sampletype = t.sampletype
											if (t.tkid) s.tkid = t.tkid
											if (t.file) s.file = t.file
											if (t.url) s.url = t.url
											if (t.indexURL) s.indexURL = t.indexURL
										}
										k.data.push(s)
									}
									delete k.rawdata
									thisfilejunctions.push(k)
								}
								resolve(thisfilejunctions)

								/*
						not in use

						if(junc.length>300) {
							// too many junctions, convert to bin
							const binw=(block.stop-block.start)/bincount
							bins=[]
							for(var i=0; i<bincount; i++) {
								bins.push(0)
							}
							junc.forEach(function(j){
								//var sum=j.data.reduce(function(sum,i){return sum+i.v},0)
								var sum=0
								j.data.forEach(function(i){sum+=i.v})
								if(j.start>=block.start && j.start<=block.stop) {
									bins[Math.floor((j.start-block.start)/binw)]+=sum
								}
								if(j.stop>=block.start && j.stop<=block.stop) {
									bins[Math.floor((j.stop-block.start)/binw)]+=sum
								}
							})
							junc=[]
						}
						*/
							}
						} else {
							/*
					not in use

					if(!bins) {
						bins=data.bins
					} else {
						for(var i=0; i<data.bins.length; i++) {
							bins[i]+=data.bins[i]
						}
					}
					if(junc.length>0) {
						// existing junc data to bin
						var binw=(block.stop-block.start)/bins.length
						junc.forEach(function(j){
							//var sum=j.data.reduce(function(sum,i){return sum+i.v},0)
							var sum=0
								j.data.forEach(function(i){sum+=i.v})
							if(j.start>=block.start && j.start<=block.stop) {
								bins[Math.floor((j.start-block.start)/binw)]+=sum
							}
							if(j.stop>=block.start && j.stop<=block.stop) {
								bins[Math.floor((j.stop-block.start)/binw)]+=sum
							}
						})
						junc=[]
					}
					*/
						}
					})
				})
				.catch(err => reject(err))
		})

		tasks.push(getdata)
	}

	Promise.all(tasks)
		.then(data => {
			const junc = []
			data.forEach(dat => {
				if (!dat) return
				dat.forEach(k => {
					// find and merge to matching junctions
					let notfound = true
					for (const j of junc) {
						if (j.start == k.start && j.stop == k.stop) {
							j.data = j.data.concat(k.data)
							notfound = false
							break
						}
					}
					if (notfound) {
						junc.push(k)
					}
				})
			})

			for (const j of junc) {
				j2block(j, block)
			}

			for (const j of junc) {
				smuggleattributes(j)
			}

			if (!tk.axisheight) {
				/*
		INITSETSIZE
		the axisheight and other sizes has not been set
		will set them here now
		*/

				if (tk.totalsamplecount > 1) {
					// multi-sample
					tk.axisheight = 200
					tk.legheight = 50
					tk.bottompad = 0
					tk.qmradius = 2
					tk.lowpad = 15
					tk.padheight = 10
				} else {
					tk.axisheight = 100
					tk.legheight = 20
					tk.bottompad = 0
					tk.lowpad = 10
					tk.padheight = 10
				}

				/*
		this is also the first time the track has been loaded
		run whatever necessary for the initial tk load
		*/
				if (tk.cohortsetting) {
					/*
			member tk .headersamples has been set
			initiate cohort setting
			so that legend by .cohort.level[.uselevelidx] can be made with .headersamples
			*/
					initcohortsetting(tk, block)
				}
			}
			rendertk(junc, tk, block)
		})
		.catch(err => {
			// clear tk
			tk.glider.selectAll('*').remove()
			block.tkcloakoff(tk, { error: err })
			block.block_setheight()
		})
}

function j2block(j, block) {
	const starthit = block.seekcoord(j.chr, j.start)[0]
	if (!starthit) {
		return true
	}
	const stophit = block.seekcoord(j.chr, j.stop)[0]
	if (!stophit) {
		return true
	}

	// if both start/stop are out of view range, skip this junction
	const startout = starthit.x < 0 || starthit.x > block.width
	const stopout = stophit.x < 0 || stophit.x > block.width

	if (startout && stopout) {
		return true
	}

	j.x0 = starthit.x
	j.x1 = stophit.x
	j.x = (j.x0 + j.x1) / 2
	j._x = j.x
	if (!j.modefix) {
		j.mode = moderaise
	}
	return false
}

function smuggleattributes(j) {
	/*
	additional attributes for junctions can be found in j.type
	*/
}

function label_mcount_fillpane(tk, block, tip) {
	tip.clear()
	const holder = tip.d

	// 1 - show types and read count
	const types = new Map()
	for (const j of tk.data) {
		if (!j.type) continue
		if (!types.has(j.type)) {
			types.set(j.type, [])
		}
		if (j.data) {
			// multi track
			types.get(j.type).push(j.data.map(i => i.v))
		} else {
			types.get(j.type).push(j.v)
		}
	}
	if (types.size) {
		const d = holder.append('div').style('margin', '8px')
		for (const [type, valuelst] of types) {
			d.append('div')
				.style('margin', '2px')
				.html(
					valuelst.length +
						' <span style="font-size:.8em;color:' +
						tk.categories[type].color +
						'">' +
						type +
						' junction' +
						(valuelst.length > 1 ? 's' : '') +
						'</span>'
				)
			// min/max of junctions of this type
			let vlst = valuelst
			if (tk.tracks) {
				vlst = []
				for (const l of valuelst) {
					vlst.push(...l)
				}
			}
			if (vlst.length == 1) {
				// only single value, don't bother min max
			} else {
				d.append('table')
					.style('margin-left', '20px')
					.html(
						'<tr><td style="text-align:right;">' +
							Math.max(...vlst) +
							'</td><td style="color:#858585;font-size:.7em">max read count</td></tr>' +
							'<tr><td style="text-align:right;">' +
							Math.min(...vlst) +
							'</td><td style="color:#858585;font-size:.7em">min</td></tr>' +
							'<tr><td style="text-align:right;">' +
							Math.ceil(vlst.reduce((i, j) => j + i, 0) / vlst.length) +
							'</td><td style="color:#858585;font-size:.7em">mean</td></tr>'
					)
			}
		}
	} else {
		// 2 - no type, show min/max
		let vlst = []
		if (tk.tracks) {
			for (const j of tk.data) {
				vlst.push(...j.data.map(i => i.v))
			}
		} else {
			vlst = tk.data.map(j => j.v)
		}
		if (vlst.length > 1) {
			holder
				.append('table')
				.html(
					'<tr><td style="text-align:right;">' +
						Math.max(...vlst) +
						'</td><td style="color:#858585;font-size:.7em">max read count</td></tr>' +
						'<tr><td style="text-align:right;">' +
						Math.min(...vlst) +
						'</td><td style="color:#858585;font-size:.7em">min</td></tr>' +
						'<tr><td style="text-align:right;">' +
						Math.ceil(vlst.reduce((i, j) => j + i, 0) / vlst.length) +
						'</td><td style="color:#858585;font-size:.7em">mean</td></tr>'
				)
		}
	}
	// 3 - set mode button
	holder
		.append('div')
		.text('Fold')
		.classed('sja_menuoption', true)
		.on('click', event => {
			tip.hide()
			for (const j of tk.data) {
				j.mode = modefold
				j.modefix = true
			}
			horiplace(tk.data, block.width, tk)
		})
	holder
		.append('div')
		.text('Expand')
		.classed('sja_menuoption', true)
		.on('click', event => {
			tip.hide()
			for (const j of tk.data) {
				j.modefix = false
			}
			automode(tk, null, block.width)
			for (const j of tk.data) {
				j.modefix = true
			}
			horiplace(tk.data, block.width, tk)
		})
	// 4 - download
	holder
		.append('div')
		.text('Download')
		.classed('sja_menuoption', true)
		.on('click', event => {
			tip.hide()
			downloadjunctions(tk)
		})
	tip.showunder(tk.label_mcount.node())
}

function label_samplecount_fillpane(tk, block, tip) {
	tip.clear()
	const holder = tip.d

	const hash = new Map()
	/*
	k: tkid
	v: {
		tkobj:,
		types:Map(), type to read count list
		readcountlst:[], if has no type
		}
	*/
	for (const t of tk.tracks) {
		const value = { tkobj: t }
		if (tk.categories) {
			value.types = new Map()
		} else {
			value.readcountlst = []
		}
		hash.set(t.tkid, value)
	}
	// sample 2 junction count
	for (const j of tk.data) {
		for (const jsample of j.data) {
			const thissample = hash.get(jsample.tkid)
			if (!thissample) {
				// should not happen
				console.log('unknown sample from tk.data: ' + jsample.tkid)
				continue
			}
			if (j.type) {
				if (!thissample.types.has(j.type)) {
					thissample.types.set(j.type, [])
				}
				thissample.types.get(j.type).push(jsample.v)
			} else {
				thissample.readcountlst.push(jsample.v)
			}
		}
	}
	const samplesortlst = [...hash]
	samplesortlst.sort((a, b) => {
		let ajunctioncount = 0
		if (a[1].types) {
			for (const readcountlst of a[1].types.values()) {
				ajunctioncount += readcountlst.length
			}
		} else {
			ajunctioncount = a[1].readcountlst.length
		}
		let bjunctioncount = 0
		if (b[1].types) {
			for (const readcountlst of b[1].types.values()) {
				bjunctioncount += readcountlst.length
			}
		} else {
			bjunctioncount = b[1].readcountlst.length
		}
		return bjunctioncount - ajunctioncount
	})
	const scrollholder = holder.append('div')
	if (samplesortlst.length > 16) {
		scrollholder
			.style('height', '300px')
			.style('padding', '5px')
			//.style('border','solid 1px #ededed')
			.style('overflow-y', 'scroll')
			.style('resize', 'vertical')
	}
	const table = scrollholder.append('table')
	// has 3 columns
	// 1. track shown or not
	// 2. tk button
	// 3. junction data stat
	for (const tmp of samplesortlst) {
		const sampledata = tmp[1]
		const tr = table.append('tr')
		const td1 = tr.append('td').style('color', '#ccc').style('font-size', '.7em')
		// whether the track of this sample has been shown
		for (const t of block.tklst) {
			if (t.tkid == sampledata.tkobj.tkid) {
				// this sample tk is hot
				td1.text('SHOWN')
				break
			}
		}
		const td2 = tr
			.append('td')
			.text(sampledata.tkobj.name)
			.classed('sja_menuoption', true)
			.on('click', event => {
				tkhandleclick(block, sampledata.tkobj, td1)
			})
		const td3 = tr.append('td').style('padding-left', '5px')
		if (sampledata.readcountlst) {
			const max = Math.max(...sampledata.readcountlst)
			td3.html(
				sampledata.readcountlst.length +
					' <span style="font-size:.8em">junction' +
					(sampledata.readcountlst > 1 ? 's' : '') +
					', max: ' +
					max +
					'</span>'
			)
		} else if (sampledata.types && sampledata.types.size > 0) {
			for (const [type, readcountlst] of sampledata.types) {
				td3
					.append('span')
					.classed('sja_mcdot', true)
					.style('margin-right', '5px')
					.style('background-color', tk.categories[type].color)
					.text(readcountlst.length)
				td3
					.append('span')
					.text('max: ' + Math.max(...readcountlst))
					.style('margin-right', '5px')
					.style('font-size', '.8em')
			}
		} else {
			td3.text('no data').style('color', '#aaa').style('font-size', '.7em')
		}
	}
	tip.showunder(tk.label_samplecount.node())
}

function downloadjunctions(tk) {
	const txt = []
	if (tk.file || tk.url) {
		// single track
		if (tk.data) {
			txt.push('chromosome\tstart\tstop\tread_count' + (tk.categories ? '\ttype' : ''))
			for (const j of tk.data) {
				txt.push(j.chr + '\t' + j.start + '\t' + j.stop + '\t' + j.v + (tk.categories ? '\t' + j.type : ''))
			}
		}
	} else if (tk.tracks) {
		if (tk.data) {
			const header = ['chromosome\tstart\tstop' + (tk.categories ? '\ttype' : '')]
			for (const t of tk.tracks) {
				const lst = []
				if (t.patient) lst.push(t.patient)
				if (t.sampletype) lst.push(t.sampletype)
				if (lst.length == 0) {
					lst.push(t.name)
				}
				header.push(lst.join(', '))
			}
			txt.push(header.join('\t'))
			for (const j of tk.data) {
				const lst = [j.chr + '\t' + j.start + '\t' + j.stop + (tk.categories ? '\t' + j.type : '')]
				const hash = new Map()
				for (const jsample of j.data) {
					hash.set(jsample.tkid, jsample.v)
				}
				for (const t of tk.tracks) {
					lst.push(hash.has(t.tkid) ? hash.get(t.tkid) : '')
				}
				txt.push(lst.join('\t'))
			}
		}
	}

	client.export_data(tk.name, [{ label: 'Splice junction', text: txt.join('\n') }])
}

function configpanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const holder = tk.tkconfigtip.d

	// read count
	{
		const row = holder.append('div').style('margin-bottom', '10px')
		row.append('span').html('Read count cutoff&nbsp;')
		row
			.append('input')
			.property('value', tk.readcountcutoff || 0)
			.attr('type', 'number')
			.style('width', '50px')
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseFloat(event.target.value)
				if (v == 0) {
					if (tk.readcountcutoff) {
						// cutoff has been set, cancel and refetch data
						tk.readcountcutoff = 0
						junctionload(tk, block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				if (!v || v < 0) {
					// invalid value
					return
				}
				// set cutoff
				if (tk.readcountcutoff) {
					// cutoff has been set
					if (tk.readcountcutoff == v) {
						// do nothing
					} else if (tk.readcountcutoff > v) {
						// lower cutoff
						tk.readcountcutoff = v
						junctionload(tk, block)
					} else {
						// raise cutoff
						tk.readcountcutoff = v
						rendertk(tk.data, tk, block)
					}
				} else {
					// cutoff has not been set
					tk.readcountcutoff = v
					junctionload(tk, block)
				}
			})
		const note = row.append('div').style('font-size', '.7em').style('color', '#858585')
		if (tk.totalsamplecount > 1) {
			// multi sample
			note.text('For a junction, samples with read count lower than cutoff will not be shown.')
		} else {
			// single sample
			note.text('Junctions with read count lower than cutoff will not be shown.')
		}
	}
}

function initcohortsetting(tk, block) {
	/*
	called when .headersamples is set
	or if tk.tracks, need to find some other time to do it

	samples from this track are annotated with cohort
	will create legend to show how samples are stratified
	will create controls for dynamic stratification
	create an independent row in td_legend to show them

	cohortsetting.cohort
		.levels[] for sample disease hierarchy
	
	TODO
	use genomic mutations to stratify samples
	*/

	if (!tk.cohortsetting.cohort) {
		client.sayerror(tk.cohortsetting.holder, '.cohort missing from tk.cohortsetting')
		return
	}
	if (!tk.cohortsetting.cohort.levels) {
		client.sayerror(tk.cohortsetting.holder, '.levels missing from tk.cohortsetting.cohort')
		return
	}
	if (!tk.cohortsetting.cohort.levels[0]) {
		client.sayerror(tk.cohortsetting.holder, 'tk.cohortsetting.cohort.levels[0] is invalid')
		return
	}

	tk.cohortsetting.levelseperator = '.'

	// set which level to use
	// array idx of cohort.levels[]
	tk.cohortsetting.uselevelidx = 0
	setcohortlegend_usecohortlevel(tk, block)
}

function setcohortlegend_usecohortlevel(tk, block) {
	/*
	call when setting cohortsetting.uselevelidx
	only to generate legend
	*/

	tk.cohortsetting.legendholder.selectAll('*').remove()

	// each time level is set, reset colorfunc
	tk.cohortsetting.colorfunc = scaleOrdinal(schemeCategory10)

	const stratkey2count = new Map()
	// k: string, v:{ count, label }

	for (const t of tk.tracks) {
		for (const s of t.headersamples) {
			if (!s[tk.cohortsetting.cohort.levels[0].k]) {
				// sample has no level 0 key, unannotated
				continue
			}
			const thissamplekeys = []
			for (let lidx = 0; lidx <= tk.cohortsetting.uselevelidx; lidx++) {
				const thislevelkey = s[tk.cohortsetting.cohort.levels[lidx].k]
				if (thislevelkey) {
					thissamplekeys.push(thislevelkey)
				}
			}
			// key of this sample
			const str = thissamplekeys.join(tk.cohortsetting.levelseperator)
			if (!stratkey2count.has(str)) {
				stratkey2count.set(str, {
					count: 0,
					label: s[tk.cohortsetting.cohort.levels[tk.cohortsetting.uselevelidx].full]
				})
			}
			stratkey2count.get(str).count++
		}
	}

	const sorteditems = [...stratkey2count].sort((a, b) => b[1].count - a[1].count)

	for (const item of sorteditems) {
		const color = tk.cohortsetting.colorfunc(item[0])
		const label = item[1].label
		const row = tk.cohortsetting.legendholder.append('div').style('margin-top', '5px')
		row
			.append('div')
			.style('display', 'inline-block')
			.attr('class', 'sja_mcdot')
			.style('background-color', color)
			.style('margin-right', '10px')
			.html('&nbsp;&nbsp;')
		row.append('div').style('display', 'inline-block').text(label)
	}
}
