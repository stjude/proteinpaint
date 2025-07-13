import tape from 'tape'
import * as d3s from 'd3-selection'
import { detectOne, detectZero, whenVisible } from '../../test/test.helpers'

/**************
 test sections

Various types of search string, no cohort filter
Case in cohort filter
Case NOT in cohort filter

***************/

// hardcoded entity and file names. change if become broken due to new data release in gdc
const validBamFileUUID = '35918f42-c424-48ef-8c95-2d87b48fdf41'
const validBamFileName = '71c2d95b-0f1d-4c32-ba5b-eb99b89b8b67_wxs_gdc_realn.bam'

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

// these things can be tested in same way, put in loop
const entities = [
	/** finds multiple files **/
	{ label: 'Case submitter', inputValue: caseSubmitter },
	{ label: 'Case UUID', inputValue: caseUUID },
	{ label: 'Case submitter (no SSM)', inputValue: caseWithoutSsm },
	{ label: 'Sample submitter', inputValue: sampleSubmitter },
	{ label: 'Sample UUID', inputValue: sampleUUID },
	{ label: 'Aliquot submitter', inputValue: aliquotSubmitter },
	{ label: 'Aliquot UUID', inputValue: aliquotUUID },
	/** finds a single file **/
	{ label: 'Bam file UUID', inputValue: validBamFileUUID, isFile: true },
	{ label: 'Bam file name', inputValue: validBamFileName, isFile: true },
	/** no file found **/
	{ label: 'Error: Invalid input ID.', inputValue: 'foobar', isErr: true }, // message printed in the indicator on the right of <input>
	{ label: 'File not viewable due to workflow type.', inputValue: 'e2d8ca95-6a3d-48e3-abfc-ce5ee294e954', isErr: true },
	{
		label: 'Error: Requested file is not a BAM file.',
		inputValue: '4e2e1320-32dd-4d3b-96f4-027d446fe19c',
		isErr: true
	},
	{ label: 'Error: No bam files available for this case.', inputValue: 'AD10525', isErr: true }
]

tape('\n', function (test) {
	test.comment('-***- GDC BAM slicing UI -***-')
	test.end()
})

tape('Hide token input', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		gdcbamslice: {
			hideTokenInput: true,
			callbacks: { postRender }
		}
	})

	let isFirstUpdate = true

	async function postRender(api) {
		await detectZero({ elem: holder, selector: '.sja-gdcbam-tokendiv' })
		test.pass('No token input is shown')
		const handle = await detectOne({ elem: holder, selector: '.sja-gdcbam-listCaseFileHandle' })
		test.equal(
			handle.innerHTML,
			'Or, Browse 1000 Available BAM Files',
			'List case file handle is shown with correct text'
		)

		handle.dispatchEvent(new Event('click'))
		await whenVisible(api.dom.tip.d.node())

		// FIXME cannot detect a file by class in the tip
		//const file = await detectOne({elem:api.dom.tip.d.node(), selector:'.sja_clbtext'})

		// trigger click on the text to search by bam and update ui, then use isFirstUpdate =true/false to reuse postRender to test

		if (test._ok) {
			holder.remove()
			api.dom.tip.d.remove()
		}
		test.end()
	}
})

for (const entity of entities) {
	tape(entity.label, test => {
		/*** must not use "async (test)=>{}" postRender runs after test finishes!! ***/

		const holder = getHolder()
		runproteinpaint({
			holder,
			noheader: true,
			gdcbamslice: {
				inputValue: entity.inputValue,
				callbacks: { postRender }
			}
		})

		async function postRender(api) {
			const input = await detectOne({ elem: holder, selector: '.sja-gdcbam-input' })
			const onefiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-onefiletable' })
			const multifiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-multifiletable' })
			const gdcid_error_div = await detectOne({ elem: holder, selector: '.sja-gdcbam-gdcid_error_div' })

			if (entity.isErr) {
				// search input causes an error
				test.ok(gdcid_error_div.innerHTML.endsWith(entity.label), 'gdcid_error_div prints proper message')
				await detectZero({ elem: onefiletable, selector: 'table' })
				await detectZero({ elem: multifiletable, selector: 'table' })
				test.pass('Both onefiletable and multifiletable are hidden')
			} else if (entity.isFile) {
				// search input is a single file, check onefiletable
				await detectZero({ elem: multifiletable, selector: 'table' })
				test.pass('no table is shown in multifiletable: isFile=true')
				const table = await detectOne({ elem: onefiletable, selector: 'table' })
				test.ok(table, 'Table is made under onefiletable for selection')
				test.equal(table.childNodes.length, 5, 'Table has 5 rows')
			} else {
				// search input is not a file, check multifiletable; NOTE must result in multiple bam files! otherwise breaks
				await detectZero({ elem: onefiletable, selector: 'table' })
				test.pass('no table is shown in onefiletable: isFile=false')
				const table = await detectOne({ elem: multifiletable, selector: 'table' })
				test.ok(table, 'Table is made under multifiletable for selection')
				test.ok(table.childNodes[1].childNodes.length >= 2, 'table displays two or more bam files')
			}

			if (test._ok) holder.remove()
			test.end()
		}
	})
}

tape('Case in cohort filter', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		filter0: gdcCohort,
		gdcbamslice: {
			inputValue: caseInCohort,
			callbacks: { postRender }
		}
	})
	async function postRender(api) {
		const input = await detectOne({ elem: holder, selector: '.sja-gdcbam-input' })
		const multifiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-multifiletable' })
		const gdcid_error_div = await detectOne({ elem: holder, selector: '.sja-gdcbam-gdcid_error_div' })
		const table = await detectOne({ elem: multifiletable, selector: 'table' })
		test.ok(table, 'Table is made under multifiletable for selection')
		test.ok(table.childNodes[1].childNodes.length >= 2, 'table displays two or more bam files')
		if (test._ok) holder.remove()
		test.end()
	}
})

tape('Case NOT in cohort filter', test => {
	const holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		filter0: gdcCohort,
		gdcbamslice: {
			inputValue: caseNotInCohort,
			callbacks: { postRender }
		}
	})
	async function postRender(api) {
		const input = await detectOne({ elem: holder, selector: '.sja-gdcbam-input' })
		const multifiletable = await detectOne({ elem: holder, selector: '.sja-gdcbam-multifiletable' })
		const gdcid_error_div = await detectOne({ elem: holder, selector: '.sja-gdcbam-gdcid_error_div' })
		test.ok(
			gdcid_error_div.innerHTML.endsWith('Error: Case not in current cohort.'),
			'gdcid_error_div prints proper message'
		)
		if (test._ok) holder.remove()
		test.end()
	}
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
