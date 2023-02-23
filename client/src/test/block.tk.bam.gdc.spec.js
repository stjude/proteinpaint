const tape = require('tape')
const d3s = require('d3-selection')
const host = window.location.origin
const { sleep, detectLst, detectOne, detectZero, whenHidden, whenVisible } = require('../../test/test.helpers')

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

/**************
 test sections

***************/

tape('\n', function(test) {
	test.pass('-***- GDC BAM slicing UI -***-')
	test.end()
})

tape('ll', async test => {
	const holder = getHolder()
	await runproteinpaint({
		holder,
		noheader:true,
		gdcbamslice:1
	})

	const input = await detectOne({ele: holder, selector:'.sja-gdcbam-input'})
	test.ok(input, 'Search box is made')
	const onefiletable = await detectOne({ele: holder, selector:'.sja-gdcbam-onefiletable'})
	test.ok(onefiletable, 'onefiletable is made')
	const multifiletable = await detectOne({ele: holder, selector:'.sja-gdcbam-multifiletable'})
	test.ok(multifiletable, 'multifiletable is made')

	test.pass('--- Case ID ---')
	{
		input.value = 'TCGA-06-0211'
		input.dispatchEvent(new Event('keyup'))
		await whenVisible(multifiletable, 3000) // TODO should become visible within 3s
		const table = await detectOne({ele: multifiletable, selector:'table'})
		test.ok(table, 'Table is made under multifiletable for selection')
		test.ok(table.childNodes[1].childNodes.length>3, 'table displays more than 3 bam files')
		table.remove()
		onefiletable.style.display='none'
		multifiletable.style.display='none'
	}

	test.pass('--- Case UUID ---')
	{
		input.value = '9a2a226e-9605-4214-9320-469305e664e6'
		input.dispatchEvent(new Event('keyup'))
		await whenVisible(multifiletable, 3000) // TODO should become visible within 3s
		const table = await detectOne({ele: multifiletable, selector:'table'})
		test.ok(table, 'Table is made under multifiletable for selection')
		test.ok(table.childNodes[1].childNodes.length>3, 'table displays more than 3 bam files')
		table.remove()
		onefiletable.style.display='none'
		multifiletable.style.display='none'
	}

	test.pass('--- File name ---')
	{
		input.value = '00493087-9d9d-40ca-86d5-936f1b951c93_wxs_gdc_realn.bam'
		input.dispatchEvent(new Event('keyup'))
		await whenVisible(onefiletable, 3000) // TODO should become visible within 3s
		const table = await detectOne({ele: onefiletable, selector:'table'})
		test.ok(table, 'Table is made under onefiletable for selection')
		test.equal(table.childNodes.length,4,'Table has 4 rows')
		table.remove()
		onefiletable.style.display='none'
		multifiletable.style.display='none'
	}

	test.pass('--- File UUID ---')
	{
		input.value = '35918f42-c424-48ef-8c95-2d87b48fdf41'
		input.dispatchEvent(new Event('keyup'))
		await whenVisible(onefiletable, 3000) // TODO should become visible within 3s
		const table = await detectOne({ele: onefiletable, selector:'table'})
		test.ok(table, 'Table is made under onefiletable for selection')
		test.equal(table.childNodes.length,4,'Table has 4 rows')
		table.remove()
		onefiletable.style.display='none'
		multifiletable.style.display='none'
	}


	if (test._ok) holder.remove()
	test.end()
})
