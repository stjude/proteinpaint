const tape = require('tape')
const d3s = require('d3-selection')
const { detectOne, detectZero, whenVisible } = require('../../test/test.helpers')

/**************
 test sections

Various types of search string, no cohort filter
Case in cohort filter
Case NOT in cohort filter

***************/

// hardcoded entity and file names. change if become broken due to new data release in gdc
const validBamFileUUID = '35918f42-c424-48ef-8c95-2d87b48fdf41'
const validBamFileName = '71c2d95b-0f1d-4c32-ba5b-eb99b89b8b67_wxs_gdc_realn.bam'

const noBamFileFoundCases = [
	{
		errMsg: 'Error: Invalid input ID.', // message printed in the indicator on the right of <input>
		inputValue: 'invalid-input-whatever'
	},
	{
		errMsg: 'File not viewable due to workflow type.',
		inputValue: 'e2d8ca95-6a3d-48e3-abfc-ce5ee294e954'
	},
	{
		errMsg: 'Error: Requested file is not a BAM file.',
		inputValue: '4e2e1320-32dd-4d3b-96f4-027d446fe19c' // is a maf file
	},
	{
		errMsg: 'Error: No bam files available for this case.',
		inputValue: 'AD10525'
	}
]

///////// below must have >=2 bam files //////////
const caseSubmitter = 'TCGA-06-0211' // tcga gbm
const caseUUID = '9a2a226e-9605-4214-9320-469305e664e6'

const sampleSubmitter = 'TCGA-E9-A1RH-11A'
const sampleUUID = 'a081f522-7603-4134-90c0-89e70fa43688'

const aliquotSubmitter = 'TCGA-E9-A1RH-11A-34R-A169-07'
const aliquotUUID = '6574e15e-7e1f-4dca-899e-56e911f27848'

///////// rare cases //////////
const caseWithoutSsm = 'DLBCL10969' // still has bam

///////// in/out cohort //////////
const gdcCohort = {
	op: 'and',
	content: [
		{ op: 'in', content: { field: 'cases.primary_site', value: ['bronchus and lung'] } },
		{
			op: 'in',
			content: { field: 'cases.summary.experimental_strategies.experimental_strategy', value: ['Methylation Array'] }
		}
	]
}
const caseInCohort = 'TCGA-91-6829'
const caseNotInCohort = caseSubmitter

tape('\n', function (test) {
	test.pass('-***- GDC BAM slicing UI -***-')
	test.end()
})

tape('Various types of search string, no cohort filter', async test => {
	const holder = getHolder()
	await runproteinpaint({
		holder,
		noheader: true,
		gdcbamslice: 1
	})

	const input = await detectOne({ elem: holder, selector: '.sja-gdcbam-input' })
	test.ok(input, 'Search box is made')
	const onefiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-onefiletable' })
	test.ok(onefiletable, 'onefiletable is made')
	const multifiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-multifiletable' })
	test.ok(multifiletable, 'multifiletable is made')
	const gdcid_error_div = await detectOne({ elem: holder, selector: '.sja-gdcbam-gdcid_error_div' })
	test.ok(gdcid_error_div, 'gdcid_error_div is made')

	// these things can be tested in same way, put in loop
	const entities = [
		{ label: 'Case submitter', name: caseSubmitter },
		{ label: 'Case UUID', name: caseUUID },
		{ label: 'Sample submitter', name: sampleSubmitter },
		{ label: 'Sample UUID', name: sampleUUID },
		{ label: 'Aliquot submitter', name: aliquotSubmitter },
		{ label: 'Aliquot UUID', name: aliquotUUID },
		{ label: 'Bam file UUID', name: validBamFileUUID, isFile: true },
		{ label: 'Bam file name', name: validBamFileName, isFile: true }
	]

	for (const entity of entities) {
		test.pass(`--- ${entity.label} ---`)
		input.value = entity.name
		input.dispatchEvent(new Event('keyup'))

		if (entity.isFile) {
			// search input is a single file, check onefiletable
			await whenVisible(onefiletable)
			test.pass('onefiletable is visible: isFile=true')
			await detectZero({ elem: multifiletable, selector: 'table' })
			test.pass('no table is shown in multifiletable: isFile=true')
			const table = await detectOne({ elem: onefiletable, selector: 'table' })
			test.ok(table, 'Table is made under onefiletable for selection')
			test.equal(table.childNodes.length, 4, 'Table has 4 rows')
			table.remove()
		} else {
			// search input is not a file, check multifiletable; NOTE must result in multiple bam files! otherwise breaks
			await whenVisible(multifiletable)
			test.pass('multifiletable is visible: isFile=false')
			await detectZero({ elem: onefiletable, selector: 'table' })
			test.pass('no table is shown in onefiletable: isFile=false')
			const table = await detectOne({ elem: multifiletable, selector: 'table' })
			test.ok(table, 'Table is made under multifiletable for selection')
			test.ok(table.childNodes[1].childNodes.length >= 2, 'table displays two or more bam files')
			table.remove() // must remove this table, otherwise it will continue to be detected in the next loop
		}
	}

	for (const { errMsg, inputValue } of noBamFileFoundCases) {
		test.pass(`--- ${errMsg} ---`)

		// must turn indicator div to hidden. when server responded, it will be turned visible and allows test to work
		gdcid_error_div.style.display = 'none'

		input.value = inputValue
		input.dispatchEvent(new Event('keyup'))
		await whenVisible(gdcid_error_div)
		test.ok(gdcid_error_div.innerHTML.endsWith(errMsg), 'gdcid_error_div prints proper message')
		await detectZero({ elem: onefiletable, selector: 'table' })
		await detectZero({ elem: multifiletable, selector: 'table' })
		test.pass('Both onefiletable and multifiletable remain hidden')
	}

	if (test._ok) holder.remove()
	test.end()
})

tape('Case in cohort filter', async test => {
	const holder = getHolder()
	await runproteinpaint({
		holder,
		noheader: true,
		gdcbamslice: 1,
		filter0: gdcCohort
	})

	const input = await detectOne({ elem: holder, selector: '.sja-gdcbam-input' })
	const multifiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-multifiletable' })
	const gdcid_error_div = await detectOne({ elem: holder, selector: '.sja-gdcbam-gdcid_error_div' })

	input.value = caseInCohort
	input.dispatchEvent(new Event('keyup'))
	await whenVisible(multifiletable)
	const table = await detectOne({ elem: multifiletable, selector: 'table' })
	test.ok(table, 'Table is made under multifiletable for selection')
	test.ok(table.childNodes[1].childNodes.length >= 2, 'table displays two or more bam files')
	table.remove() // must remove this table, otherwise it will continue to be detected in the next loop

	if (test._ok) holder.remove()
	test.end()
})

tape('Case NOT in cohort filter', async test => {
	const holder = getHolder()
	await runproteinpaint({
		holder,
		noheader: true,
		gdcbamslice: 1,
		filter0: gdcCohort
	})

	const input = await detectOne({ elem: holder, selector: '.sja-gdcbam-input' })
	const multifiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-multifiletable' })
	const gdcid_error_div = await detectOne({ elem: holder, selector: '.sja-gdcbam-gdcid_error_div' })

	// must turn indicator div to hidden. when server responded, it will be turned visible and allows test to work
	gdcid_error_div.style.display = 'none'

	input.value = caseNotInCohort
	input.dispatchEvent(new Event('keyup'))

	await whenVisible(gdcid_error_div, { wait: 10000 })
	test.ok(
		gdcid_error_div.innerHTML.endsWith('Error: Case not in current cohort.'),
		'gdcid_error_div prints proper message'
	)

	if (test._ok) holder.remove()
	test.end()
})

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}
