/*

only one source of data: loaded from server

*/

// duplicated stuff from dataset/pediatric.js
const valuePerSample = {
	key: 'percentage',
	label: 'Percentage',
	cutoffValueLst: [
		{ side: '>', value: 5, label: '>5%' },
		{ side: '>', value: 10, label: '>10%' },
		{ side: '>', value: 20, label: '>20%' },
		{ side: '>', value: 30, label: '>30%' },
		{ side: '>', value: 40, label: '>40%' }
	]
}

export function mdsjunctionfromtemplate(tk, template) {
	if (template.axisheight) {
		const v = Number.parseInt(template.axisheight)
		if (Number.isNaN(v)) return 'invalid value for axisheight'
		tk.axisheight = v
	} else {
		tk.axisheight = 200
	}
	if (template.legheight) {
		const v = Number.parseInt(template.legheight)
		if (Number.isNaN(v)) return 'invalid value for legheight'
		tk.legheight = v
	} else {
		tk.legheight = 50
	}
	if (template.neckheight) {
		const v = Number.parseInt(template.neckheight)
		if (Number.isNaN(v)) return 'invalid value for neckheight'
		tk.neckheight = v
	} else {
		tk.neckheight = 50
	}
	tk.height_main = tk.toppad + tk.axisheight + tk.legheight + tk.neckheight + tk.bottompad
	tk.yscaleUseLog = template.yscaleUseLog != undefined ? template.yscaleUseLog : true
	if (tk.iscustom) {
		// custom mdsjunction
		tk.mds = {}

		if (template.infoFilter) {
			if (!template.infoFilter.lst) return '.lst missing from infoFilter'
			tk.infoFilter = { lst: [] }
			for (const i of template.infoFilter.lst) {
				if (!i.key) return '.key missing from an item of .infoFilter.lst'
				if (!i.label) i.label = i.key
				if (!i.categories) return '.categories missing from an item of .infoFilter.lst'
				const o = {
					key: i.key,
					label: i.label,
					categories: {},
					hiddenCategories: {}
				}
				for (const k in i.categories) {
					o.categories[k] = i.categories[k]
				}
				if (i.hiddenCategories) {
					for (const k in i.hiddenCategories) {
						o.hiddenCategories[k] = 1
					}
				}
				tk.infoFilter.lst.push(o)
			}
		} else {
			// no infoFilter from custom tk, use the hardcoded one given that the junction annotation will be done by pp script
			tk.infoFilter = {
				lst: [
					{
						key: 'type',
						label: 'Type',
						categories: {
							canonical: {
								label: 'Canonical',
								color: '#0C72A8'
							},
							exonskip: {
								label: 'Exon skipping',
								color: '#D14747',
								valuePerSample: valuePerSample
							},
							exonaltuse: {
								label: 'Exon alternative usage',
								color: '#E69525',
								valuePerSample: valuePerSample
							},
							a5ss: {
								label: "Alternative 5' splice site",
								color: '#476CD1',
								valuePerSample: valuePerSample
							},
							a3ss: {
								label: "Alternative 3' splice site",
								color: '#47B582',
								valuePerSample: valuePerSample
							},
							Unannotated: {
								label: 'Not annotated',
								color: '#787854'
							}
						},
						hiddenCategories: { Unannotated: 1 }
					}
				]
			}
		}
	}
	return null
}

export function mdsjunctionmaketk(tk, block) {
	tk.leftaxis = tk.gleft.append('g')
	tk.tktip.d.style('padding', '8px')
	tk.subTracks = [] // as a parent track, collect subtracks (subtrack won't have this)
	tk.uninitialized = true
	// everything to be made in mdsjunction.render, since handles and config will rerender the track
}

export function mdsjunctionload(tk, block) {
	import('./block.mds.junction').then(module => {
		module.loadTk(tk, block)
	})
}
