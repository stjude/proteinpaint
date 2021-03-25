import { event as d3event } from 'd3-selection'
import * as client from './client'

export function may_add_kmplotbutton(smat, buttonrow) {
	if (!smat.mds || !smat.mds.survivalplot) return
	// only a temp solution
	buttonrow
		.append('span')
		.style('margin-right', '20px')
		.style('font-size', '.8em')
		.text('SURVIVAL PLOT')
		.attr('class', 'sja_clbtext')
		.on('click', () => {
			smat.menu.clear().showunder(d3event.target)
			kmplot_menu(smat)
		})
}

async function kmplot_menu(smat) {
	const mutation_features = smat.features.filter(i => i.ismutation)

	try {
		if (mutation_features.length != 2) throw 'only works with two genomic features.'
		await kmplot_do(smat, mutation_features[0], mutation_features[1])
	} catch (e) {
		smat.menu.d
			.append('div')
			.style('margin', '20px')
			.text('Cannot make survival plot: ' + (e.message || e))
	}
}

async function kmplot_do(smat, f1, f2) {
	/*
with two mutation features
stratify current samples to 3 groups (f1-only, f2-only, both)
then perform kmplot
*/
	const s1 = [], // only mutated in f1
		s2 = [], // only mutated in f2
		s12 = [] // mutated in both
	for (const i of smat.samples) {
		const in1 = f1.items.find(j => j.sample == i.name)
		const in2 = f2.items.find(j => j.sample == i.name)
		if (in1) {
			if (in2) s12.push(i.name)
			else s1.push(i.name)
		} else {
			s2.push(i.name)
		}
	}

	const plot = {
		renderplot: 1,
		samplerule: {
			full: {},
			mutated_sets: [
				{ name: f1.label + ' mutated (n=' + s1.length + ')', samplenames: s1 },
				{ name: f2.label + ' mutated (n=' + s2.length + ')', samplenames: s2 },
				{ name: f1.label + ' and ' + f2.label + ' mutated (n=' + s12.length + ')', samplenames: s12 }
			]
		}
	}

	if (smat.limitsamplebyeitherannotation) {
		plot.samplerule.full = {
			byattr: 1,
			key: smat.limitsamplebyeitherannotation[0].key,
			value: smat.limitsamplebyeitherannotation[0].value,
			immutable: 1
		}
	}

	const pane = client.newpane({ x: 100, y: 100 })

	pane.header.text(
		(smat.limitsamplebyeitherannotation ? smat.limitsamplebyeitherannotation[0].value + ' ' : '') +
			'survival by ' +
			f1.label +
			' and ' +
			f2.label +
			' mutation status'
	)

	const _ = await import('./mds.survivalplot')
	_.init(
		{
			mds: smat.mds,
			genome: smat.genome,
			plotlist: [plot]
		},
		pane.body
	)
}
