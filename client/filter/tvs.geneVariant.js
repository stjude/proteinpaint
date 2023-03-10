import { select } from 'd3-selection'
import { mclass, dt2label } from '#shared/common'
/*
********************** EXPORTED
handler:
    // internal functions as part of handler
    term_name_gen()
    get_pill_label()
    getSelectRemovePos()
    fillMenu()
    setTvsDefaults()
*/

export const handler = {
	type: 'geneVariant',
	term_name_gen,
	get_pill_label,
	getSelectRemovePos,
	fillMenu,
	setTvsDefaults
}

async function fillMenu(self, _div, tvs) {
	const data = await self.opts.vocabApi.getCategories(tvs.term, self.filter, {})
	const dtClassMap = new Map()
	for (const l of data.lst) {
		dtClassMap.set(l.dt, l.classes)
	}
	const div = _div
		.append('div')
		.style('padding', '5px')
		.style('cursor', 'pointer')

	div
		.append('div')
		.style('font-size', '1.2rem')
		.text(self.tvs.term.name)
	const applyBtn = div
		.append('button')
		.property('disabled', true)
		.style('margin-top', '3px')
		.text('Apply')
		.on('click', () => {
			const values = []
			for (const group of groups) {
				const items = group.items
				for (const item of items) {
					if (!values.some(v => v.dt == item.dt && (item.origin ? item.origin == v.origin : true))) {
						const value = { dt: item.dt, mclassLst: [], mclassExcludeLst: [] }
						if (item.origin) value.origin = item.origin
						values.push(value)
					}
					const itemValue = values.filter(v => v.dt == item.dt && (item.origin ? item.origin == v.origin : true))[0]
					const mclassLst = itemValue.mclassLst
					const mclassExcludeLst = itemValue.mclassExcludeLst
					if (
						exclude.some(e => e.dt == item.dt && e.key == item.key && (item.origin ? item.origin == e.origin : true))
					) {
						mclassExcludeLst.push(item.key)
					} else {
						mclassLst.push(item.key)
					}
				}
			}
			/* values is an array that stores classes (for each available dt) that have/haven't been crossed out by the user at this round of edit-and-apply, e.g.
            [
                {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'G'}
                {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'S'},
                {dt: 2, mclassLst: ['Blank', 'WT'], mclassExcludeLst:[]}
                {dt: 4, mclassLst: ['WT', 'CNV_loss'], mclassExcludeLst:[]}
            ]
            */
			const newTvs = {
				term: self.tvs.term,
				values
			}
			self.opts.callback(newTvs)
		})

	const groups = []
	for (const [dt, classes] of dtClassMap) {
		/* dtClassMap is a map that shows after-filtered numbers of all classes for each avaiable dt. e.g.
            1 : { WT: 55, Blank: 18, M: 5, N: 1, F: 1 },
            2 : {Blank: 53, WT: 27}
            4 : {WT: 77, CNV_loss: 1, Blank: 2}

            if distinguish between somatic and germline snv/indel:   
            1 : {
                    byOrigin: {
                        G: { Blank: 45, WT: 35 },
                        S: { WT: 55, Blank: 18, M: 5, N: 1, F: 1 }
                    }
                }
        */
		if (classes.byOrigin) {
			buildItems(classes.byOrigin['G'], dt, 'G')
			buildItems(classes.byOrigin['S'], dt, 'S')
		} else {
			buildItems(classes, dt)
		}

		function buildItems(classes, dt, origin) {
			const items = []
			for (const [c, num] of Object.entries(classes)) {
				const item = { ...mclass[c] }
				item.dt = dt
				item.num = num
				if (origin) item.origin = origin
				items.push(item)
			}
			items.sort((item1, item2) => item2.num - item1.num)
			if (items.length) {
				groups.push({
					name:
						dt == 1 && origin == 'G'
							? 'Germline SNV/indel'
							: dt == 1 && origin == 'S'
							? 'Somatic SNV/indel'
							: dt2label[dt],
					items
				})
			}
		}
	}
	/* groups is an array that contains each dt as {name, items}, items is an array that contains the dt's classes in the format of {dt, label, key, num, origin}
    [
        {name: 'Germline SNV/indel', items:[{dt: '1', label: "Not tested",  key: 'Blank', num:64, origin:'G'}, ...]}},
        {name: 'Somatic SNV/indel', items:[{dt: 1, label: "Not tested",  key: 'Blank', num:44, origin'S'}, ...]}},
        {name: 'Fusion RNA', items:[{dt: 2, label: "Not tested",  key: 'Blank', num:53}, ...]}},
        {name: 'CNV', items:[{dt: 4, label: "Not tested",  key: 'Blank', num:77}, ...]}}
    ]
    */
	const exclude = []
	if (tvs.values.length) {
		/* tvs.values is an array that stores classes (for each available dt) that have/haven't been crossed out by the user at the last round of edit-and-apply, e.g.
            [
                {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'G'}
                {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'S'},
                {dt: 2, mclassLst: ['Blank', 'WT'], mclassExcludeLst:[]}
                {dt: 4, mclassLst: ['WT', 'CNV_loss'], mclassExcludeLst:[]}
            ]
            */
		for (const group of groups) {
			for (const item of group.items) {
				const mclassExcludeLst = tvs.values.filter(
					v => v.dt == item.dt && (item.origin ? item.origin == v.origin : true)
				)[0].mclassExcludeLst
				if (mclassExcludeLst.includes(item.key)) exclude.push(item)
			}
		}
	}
	const origExclude = JSON.stringify(exclude)
	/*
    exclude is an array of class/item crossed by users, as {dt, label, key, num, origin}, same as item in groups, e.g.,
    [
        {dt: "1", key: "WT", label: "Wildtype", num: 35, origin: 'G'},
        {dt: "1", key: "WT", label: "Wildtype", num: 25, origin: 'S'},
        {dt: 4, key: "CNV_loss", label: "Copy number loss", num: 1}
    ]
    */

	const dtDiv = div
		.append('div')
		.selectAll(':scope>div')
		.data(groups, d => d.name)
		.enter()
		.append('div')
		.style('max-width', '500px')
		.style('margin', '10px')
		.style('padding-left', '10px')
		.style('text-align', 'left')
		.each(function(grp) {
			const div = select(this)
			div
				.append('div')
				.style('font-weight', 600)
				.html(grp.name)
			//.on('click', )

			div
				.selectAll(':scope>div')
				.data(grp.items, d => d.label)
				.enter()
				.append('div')
				.style('margin', '5px')
				.style('display', 'inline-block')
				.on('click', function(event, d) {
					const i = exclude.findIndex(e => e.key == d.key && e.dt == d.dt && (d.origin ? d.origin == e.origin : true))
					if (i == -1) exclude.push(d)
					else exclude.splice(i, 1)
					select(this.lastChild).style('text-decoration', i == -1 ? 'line-through' : '')
					select(this.lastChild).style('text-decoration-thickness', i == -1 ? '3px' : '')
					applyBtn.property('disabled', JSON.stringify(exclude) === origExclude)
				})
				.each(function(d) {
					const itemDiv = select(this)
					itemDiv
						.append('div')
						.style('display', 'inline-block')
						.style('width', '1rem')
						.style('height', '1rem')
						.style('border', '1px solid #ccc')
						.style('background-color', d.color)
						.html('&nbsp;')

					itemDiv
						.append('div')
						.style('display', 'inline-block')
						.style('margin-left', '3px')
						.style(
							'text-decoration',
							exclude.some(e => e.key == d.key && e.dt == d.dt && (d.origin ? d.origin == e.origin : true))
								? 'line-through'
								: ''
						)
						.style(
							'text-decoration-thickness',
							exclude.some(e => e.key == d.key && e.dt == d.dt && (d.origin ? d.origin == e.origin : true)) ? '3px' : ''
						)
						.style('cursor', 'pointer')
						.text(`${d.label} (n=${d.num})`)
				})
		})
}

function term_name_gen(d) {
	const name = d.term.name
	return name.length < 21 ? name : '<label title="' + name + '">' + name.substring(0, 18) + '...' + '</label>'
}

function get_pill_label(tvs) {
	return {
		txt: tvs.values?.reduce((accumulator, currentValue) => accumulator + currentValue.mclassLst.length, 0) + ' groups'
	}
}

function getSelectRemovePos(j) {
	return j
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
}
