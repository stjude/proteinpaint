import { select } from 'd3-selection'
import { mclass, dt2label } from '#shared/common.js'
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
	const div = _div.append('div').style('padding', '5px').style('cursor', 'pointer')

	div.append('div').style('font-size', '1.2rem').text(self.tvs.term.name)

	const btnAndWarningDiv = div.append('div').style('display', 'flex').style('align-items', 'center')
	const applyBtn = btnAndWarningDiv
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
                {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'germline'}
                {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'somatic'},
                {dt: 2, mclassLst: ['Blank', 'WT'], mclassExcludeLst:[]}
                {dt: 4, mclassLst: ['WT', 'CNV_loss'], mclassExcludeLst:[]}
            ]
            */
			const newTvs = {
				term: self.tvs.term,
				values,
				isnot: tvs.isnot
			}
			self.opts.callback(newTvs)
		})

	const noteDiv = div
		.append('div')
		.style('font-weight', 'bold')
		.style('margin', '10px 5px 5px 10px')
		.text('Filter by only one group within which select 1 or more categories for INCLUSION')

	const groups = []
	for (const [dt, classes] of dtClassMap) {
		/* dtClassMap is a map that shows after-filtered numbers of all classes for each avaiable dt. e.g.
            1 : { WT: 55, Blank: 18, M: 5, N: 1, F: 1 },
            2 : {Blank: 53, WT: 27}
            4 : {WT: 77, CNV_loss: 1, Blank: 2}

            if distinguish between somatic and germline snv/indel:   
            1 : {
                    byOrigin: {
                        germline: { Blank: 45, WT: 35 },
                        somatic: { WT: 55, Blank: 18, M: 5, N: 1, F: 1 }
                    }
                }
        */
		if (classes.byOrigin) {
			for (const [k, v] of Object.entries(classes.byOrigin)) {
				buildItems(v, dt, k)
			}
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
					name: origin ? `${origin.charAt(0).toUpperCase() + origin.slice(1)} ${dt2label[dt]}` : dt2label[dt],
					items
				})
			}
		}
	}
	/* groups is an array that contains each dt as {name, items}, items is an array that contains the dt's classes in the format of {dt, label, key, num, origin}
    [
        {name: 'Germline SNV/indel', items:[{dt: '1', label: "Not tested",  key: 'Blank', num:64, origin:'germline'}, ...]}},
        {name: 'Somatic SNV/indel', items:[{dt: 1, label: "Not tested",  key: 'Blank', num:44, origin'somatic'}, ...]}},
        {name: 'Fusion RNA', items:[{dt: 2, label: "Not tested",  key: 'Blank', num:53}, ...]}},
        {name: 'CNV', items:[{dt: 4, label: "Not tested",  key: 'Blank', num:77}, ...]}}
    ]
    */
	const exclude = []
	if (tvs.values.length) {
		/* tvs.values is an array that stores classes (for each available dt) that have/haven't been crossed out by the user at the last round of edit-and-apply, e.g.
            [
                {dt: 1, mclassLst: ['WT'], mclassExcludeLst: ['Blank'], origin: 'germline'}
                {dt: 1, mclassLst: ['Blank', 'WT', 'M'], mclassExcludeLst:[], origin:'somatic'},
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
        {dt: "1", key: "WT", label: "Wildtype", num: 35, origin: 'germline'},
        {dt: "1", key: "WT", label: "Wildtype", num: 25, origin: 'somatic'},
        {dt: 4, key: "CNV_loss", label: "Copy number loss", num: 1}
    ]
    */

	// defaultGrp is the default selected group when users first open a new gene filter. It is the group with the highest number of  mclass
	const defaultGrp = exclude.length
		? null
		: groups.reduce((maxObject, currentObject) => {
				if (currentObject.items.length > maxObject.items.length) return currentObject
				return maxObject
		  }, groups[0])

	const radioName = Math.random().toString()
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
		.style('opacity', 0.5)
		.each(function (grp) {
			const div = select(this)
			const dtTitleDiv = div.append('label').style('display', 'flex')
			// grpEdited indicates if the group was used as filter when the filter was created. Should be checked when editting the filter
			const grpEdited = exclude.some(e => grp.items.some(i => i.dt == e.dt && (i.origin ? i.origin == e.origin : true)))
			const radioInput = dtTitleDiv
				.append('input')
				.attr('type', 'radio')
				.attr('name', radioName)
				.property('checked', grpEdited || defaultGrp == grp)
				.on('click', () => {
					dtDiv.style('opacity', 0.5)
					div.style('opacity', 1)
					dtDiv.selectAll('input[type="checkbox"]').property('disabled', true)
					mClassDiv.selectAll('input[type="checkbox"]').property('disabled', false)
					dtDiv.selectAll('.sjpp_row_wrapper').style('display', 'none')
					mClassDiv.style('display', 'inline-block')
					dtDiv.selectAll('input[type="checkbox"]').property('checked', true)
					exclude.splice(0, exclude.length)
					applyBtn.property('disabled', JSON.stringify(exclude) === origExclude || exclude.length == 0)
				})
			div.style('opacity', grpEdited || defaultGrp == grp ? 1 : 0.5)

			const dtTitle = dtTitleDiv.append('span').style('font-weight', 600).html(grp.name)

			const checkboxName = Math.random().toString()
			const mClassDiv = div
				.selectAll(':scope>div')
				.data(grp.items, d => d.label)
				.enter()
				.append('label')
				.style('margin', '5px')
				.style('margin-left', '20px')
				.style('display', radioInput.property('checked') ? 'inline-block' : 'none')
				.each(function (d) {
					const itemDiv = select(this)
					itemDiv.attr('class', 'sjpp_row_wrapper')
					const checkboxDiv = itemDiv
						.append('input')
						.attr('type', 'checkbox')
						.attr('name', checkboxName)
						.property('disabled', radioInput.property('checked') ? false : true)
						.property(
							'checked',
							exclude.some(e => e.key == d.key && e.dt == d.dt && (d.origin ? d.origin == e.origin : true))
								? false
								: true
						)
						.style('vertical-align', 'top')
						.style('margin-right', '3px')
						.on('change', function (event, d) {
							const i = exclude.findIndex(
								e => e.key == d.key && e.dt == d.dt && (d.origin ? d.origin == e.origin : true)
							)
							if (i == -1) exclude.push(d)
							else exclude.splice(i, 1)
							let modifiedMultiGrps = false
							if (exclude.length > 1) {
								const firstExclude = exclude[0].origin ? `${exclude[0].origin} ${exclude[0].dt}` : exclude[0].dt
								for (const v of exclude.slice(1)) {
									const e = v.origin ? `${v.origin} ${v.dt}` : v.dt
									if (e !== firstExclude) {
										modifiedMultiGrps = true
										break
									}
								}
							}
							applyBtn.property('disabled', JSON.stringify(exclude) === origExclude || exclude.length == 0)
						})
					itemDiv.append('span').style('margin-left', '3px').html(`${d.label} (n=${d.num})`)
				})
		})
}

function term_name_gen(d) {
	const name = d.term.name
	return name.length < 21 ? name : '<label title="' + name + '">' + name.substring(0, 18) + '...' + '</label>'
}

function get_pill_label(tvs) {
	const modifiedGrp = tvs.values.filter(v => v.mclassExcludeLst.length > 0)[0]
	const mGroup = dt2label[modifiedGrp.dt]

	if (modifiedGrp.mclassLst.length == 1) {
		// single
		const m = modifiedGrp.mclassLst[0]
		return { txt: `${mGroup}:${m}` }
	}
	// multiple
	return { txt: `${mGroup}:${modifiedGrp.mclassLst.length} groups` }
}

function getSelectRemovePos(j) {
	return j
}

function setTvsDefaults(tvs) {
	if (!tvs.values) tvs.values = []
}
