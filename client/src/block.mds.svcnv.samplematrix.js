import * as common from '#shared/common.js'
import * as client from './client'
import { string2pos, invalidcoord } from './coord'
import { getsjcharts } from './getsjcharts'

/*

********************** EXPORTED
may_show_samplematrix_button
createbutton_addfeature
createnewmatrix_withafeature

********************** INTERNAL
addnewfeature_nosamplefilter


created smat is stored in tk.samplematrices[]

createbutton_addfeature():
	launches smat by a mutation, creates a feature
	subsequent selection of new mutations will add features to this same smat
	each feature is limited to that type of mutation
	does not restrict samples
	there should only be one such matrix

clicking Matrix view on sample group label
	launches a smat including all types of mutation
	restrict samples to the group
	one matrix can be created for each sample group
	official only

each time creating either matrix, must find out if it has already existed in samplematrices[]
currently a hardcoded method of telling that is through limitsamplebyeitherannotation
	if this attr exists, it belongs to one of sample group
	otherwise, it is first type



hardcoded keys to identify tracks in querykey2tracks of a custom dataset
only used to correlate feature.querykey to its track in smat.querykey2tracks
their literal value won't be used in server

this requires that, in custom dataset,
	*** there can be only 1 track of each type ***
	e.g. there cannot be two svcnv tracks...

*/

export const customkey_svcnv = 'svcnv'
export const customkey_vcf = 'vcf'
export const customkey_expression = 'expression'

export function createbutton_addfeature(p) {
	/*
	create a button for adding feature to samplematrix
	the feature is underlied by m (m.dt for datatype)

	no sample filter: this feature does not restrict samples to a group
	*/

	const { m, tk, block, holder } = p

	if (!m) return

	if (m.dt == common.dtcnv || m.dt == common.dtloh) {
		/*
		server has 10mb range limit hardcoded
		to avoid embarrassment, do not show button when out of limit
		*/
		if (m.stop - m.start >= 10000000) {
			return
		}
	}

	// generate new feature beforehand
	let nf

	switch (m.dt) {
		case common.dtcnv:
			nf = {
				iscnv: 1,
				label: m.chr + ' ' + common.bplen(m.stop - m.start) + ' CNV',
				querykey: tk.iscustom ? customkey_svcnv : tk.querykey,
				chr: m.chr,
				start: m.start,
				stop: m.stop,
				valuecutoff: tk.valueCutoff,
				focalsizelimit: tk.bplengthUpperLimit,
				colorgain: tk.cnvcolor.gain.str,
				colorloss: tk.cnvcolor.loss.str
			}
			break
		case common.dtloh:
			nf = {
				isloh: 1,
				label: m.chr + ' ' + common.bplen(m.stop - m.start) + ' LOH',
				querykey: tk.iscustom ? customkey_svcnv : tk.querykey,
				chr: m.chr,
				start: m.start,
				stop: m.stop,
				valuecutoff: tk.segmeanValueCutoff,
				focalsizelimit: tk.lohLengthUpperLimit,
				color: tk.cnvcolor.loh.str
			}
			break
		case common.dtgeneexpression:
			if (!tk.gene2coord) {
				holder.text('tk.gene2coord missing')
				return
			}
			const tmp = tk.gene2coord[m.genename]
			if (!tmp) {
				holder.text('No position for ' + m.genename)
				return
			}
			nf = {
				isgenevalue: 1,
				querykey: tk.iscustom ? customkey_expression : tk.checkexpressionrank.querykey,
				genename: m.genename,
				label: m.genename + ' expression',
				chr: tmp.chr,
				start: tmp.start,
				stop: tmp.stop
			}
			break
		case common.dtsnvindel:
			nf = {
				isvcf: 1,
				querykey: tk.iscustom ? customkey_vcf : tk.checkvcf.querykey,
				label: 'Mutation at ' + m.chr + ':' + m.pos,
				chr: m.chr,
				start: m.pos,
				stop: m.pos
			}
			break
		case common.dtitd:
			nf = {
				isitd: 1,
				querykey: tk.iscustom ? customkey_svcnv : tk.querykey,
				label: 'ITD at ' + m.chr + ':' + (m.start + 1) + '-' + (m.stop + 1),
				chr: m.chr,
				start: m.start,
				stop: m.stop
			}
			break
		case common.dtsv:
		case common.dtfusionrna:
			// TODO hardcoded range +/- 1k
			nf = {
				issvfusion: 1,
				querykey: tk.iscustom ? customkey_svcnv : tk.querykey,
				label: 'SV/fusion around ' + m._chr + ':' + (m._pos + 1),
				chr: m._chr,
				start: Math.max(0, m._pos - 1000),
				stop: m._pos + 1000
			}
			break
		default:
			console.log('createbutton_addfeature: unknown dt')
			return
	}

	const button = holder
		.append('div')
		.style('display', 'inline-block')
		.attr('class', 'sja_menuoption')
		.text('Add feature: ' + nf.label)
		.on('click', () => {
			if (p.pane) {
				// close old pane
				p.pane.pane.remove()
			}

			addnewfeature_nosamplefilter(nf, tk, block)
		})
}

function addnewfeature_nosamplefilter(nf, tk, block) {
	/*
	will generate a matrix without sample filtering
	if the matrix does not exist, create it;
	otherwise, add the new feature to it

	*/

	const smat = tk.samplematrices.find(i => !i.limitsamplebyeitherannotation) // hardcoded to use this attribute to tell

	if (!smat) {
		createnewmatrix_withafeature({
			feature: nf,
			tk: tk,
			block: block
		})
		return
	}

	// already exists
	if (smat._pane.pane.style('display') == 'none') {
		// show first
		client.appear(smat._pane.pane)
	}

	smat.addnewfeature_update(nf)
}

export async function createnewmatrix_withafeature(_p) {
	// create new instance
	const { feature, tk, block, limitsamplebyeitherannotation, limitbysamplesetgroup } = _p

	const pane = client.newpane({
		x: 100,
		y: 100,
		close: () => {
			client.flyindi(pane.pane, tk.config_handle)
			pane.pane.style('display', 'none')
		}
	})

	if (limitsamplebyeitherannotation) {
		// from matrix view of a sample group
		const a = limitsamplebyeitherannotation[0]
		if (a) {
			pane.header.html('<span style="font-size:.8em;opacity:.5">' + tk.name + '</span> ' + a.value)
		}
	} else if (limitbysamplesetgroup) {
		pane.header.html('<span style="font-size:.8em;opacity:.5">' + tk.name + '</span> ' + limitbysamplesetgroup.name)
	} else {
		pane.header.text(tk.name)
	}

	const arg = {
		debugmode: block.debugmode,
		genome: block.genome,
		features: [feature],
		hostURL: block.hostURL,
		limitsamplebyeitherannotation,
		limitbysamplesetgroup,
		jwt: block.jwt,
		holder: pane.body.append('div').style('margin', '20px')
	}

	if (tk.iscustom) {
		arg.iscustom = 1
		arg.querykey2tracks = {}
		arg.querykey2tracks[customkey_svcnv] = {
			type: common.tkt.mdssvcnv,
			file: tk.file,
			url: tk.url,
			indexURL: tk.indexURL
		}
		if (tk.checkexpressionrank) {
			/*
			gene expression track file "type" is only temporary,
			since in mds.queries, this data is not regarded as a track, thus has no type
			add type here so server code won't break
			*/
			arg.querykey2tracks[customkey_expression] = {
				type: common.tkt.mdsexpressionrank
			}
			for (const k in tk.checkexpressionrank) {
				arg.querykey2tracks[customkey_expression][k] = tk.checkexpressionrank[k]
			}
		}
		if (tk.checkvcf) {
			// hardcoded one single vcf file
			arg.querykey2tracks[customkey_vcf] = {
				type: common.tkt.mdsvcf
			}
			for (const k in tk.checkvcf) {
				if (k == 'stringifiedObj') continue
				arg.querykey2tracks[customkey_vcf][k] = tk.checkvcf[k]
			}
		}
	} else {
		// official
		arg.dslabel = tk.mds.label
	}

	// dynamic import works with static values, not expressions
	if (window.location.search.includes('smx=3')) {
		arg.client = client
		arg.common = common
		arg.string2pos = string2pos
		arg.invalidcoord = invalidcoord
		arg.block = import('./block.js')
		const sjcharts = await getsjcharts()
		sjcharts.dthm(arg).then(m => {
			m._pane = pane
			tk.samplematrices.push(m)
		})
	} else {
		import('./samplematrix').then(_ => {
			const m = new _.Samplematrix(arg)
			m._pane = pane
			tk.samplematrices.push(m)
		})
	}
}

export function may_show_samplematrix_button(tk, block) {
	/*
	if samplematrix is hidden, show button in config menu
	*/
	if (!tk.samplematrices || tk.samplematrices.length == 0) return

	const table = tk.tkconfigtip.d.append('table').style('margin-bottom', '5px')

	for (const m of tk.samplematrices) {
		const tr = table.append('tr')

		{
			// name

			const words = []
			if (m.limitsamplebyeitherannotation) {
				// by sample group
				const a = m.limitsamplebyeitherannotation[0]
				words.push(a.value)
			} else if (m.limitbysamplesetgroup) {
				words.push(m.limitbysamplesetgroup.name)
			} else {
				// general
				words.push('Any sample')
			}
			const c = m.features.length
			words.push(c + ' feature' + (c > 1 ? 's' : ''))

			words.push(m.samples.length + ' samples')

			const div = tr
				.append('td')
				.append('div')
				.attr('class', 'sja_menuoption')
				.style('border', 'solid 1px #ededed')
				.text(words.join(', '))
			if (m._pane.pane.style('display') == 'none') {
				div.style('border-color', 'black')
			}
			div.on('click', () => {
				if (m._pane.pane.style('display') == 'none') {
					client.appear(m._pane.pane)
					client.flyindi(div, m._pane.pane)
					div.style('border-color', '#ededed')
				} else {
					client.flyindi(m._pane.pane, div)
					client.disappear(m._pane.pane)
					div.style('border-color', 'black')
				}
			})
		}

		{
			// remove
			tr.append('td')
				.attr('class', 'sja_menuoption')
				.html('&times;')
				.on('click', () => {
					tr.remove()
					m._pane.pane.remove()
					for (const [i, m2] of tk.samplematrices.entries()) {
						if (m.limitsamplebyeitherannotation) {
							if (m2.limitsamplebyeitherannotation) {
								const a = m.limitsamplebyeitherannotation[0]
								const b = m2.limitsamplebyeitherannotation[0]
								if (a.key == b.key && a.value == b.value) {
									tk.samplematrices.splice(i, 1)
									return
								}
							}
						} else {
							if (!m2.limitsamplebyeitherannotation) {
								tk.samplematrices.splice(i, 1)
								return
							}
						}
					}
				})
		}
	}
}
