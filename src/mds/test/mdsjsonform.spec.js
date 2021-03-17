import tape from 'tape'
import { select } from 'd3-selection'
import * as client from '../../client'
import { init_mdsjsonform } from '../../mdsjsonform'

/**
	run it as:
	$ cd src/mainapp/test/
	$ npx watchify mdsjsonform.spec.js -o ../../../public/bin/spec.bundle.js -v

	after it starts, open this url in brower: http://localhost:3000/testrun.html
	result of tests will be in browser console
	refresh the page to rerun all tests

	troubleshoot help: 
	if testrun.html prints 'This feature is not enabled on this server.',
	add '"features":{"mdsjsonform": true}' to serverconfig.json.
 */

/*************************
 reusable helper functions
**************************/

async function getOpts(_opts = {}) {
	const holder = select('body')
		.append('div')
		.style('position', 'relative')
		.style('margin', '20px')
		.style('border', '1px solid #000')

	let genomes = await getGenomes()

	const opts = Object.assign(
		{
			holder,
			genomes,
			callback(form) {
				opts.formData = form
			}
		},
		_opts
	)

	return opts
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function getGenomes() {
	const data = await client.dofetch2('genomes')
	if (!data.genomes) throw 'error'
	return data.genomes
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- mdsjson from -***-')
	test.end()
})

tape('Check components of mdsjson form', async test => {
	test.timeoutAfter(3000)

	const opts = await getOpts()

	const arg = {
		holder: opts.holder,
		genomes: opts.genomes,
		debug: 1
	}

	await init_mdsjsonform(arg)

	const spans = opts.holder.node().querySelectorAll('span')
	// console.log(window.doms)
	// Suggestion:
	// can use 'windows.doms' insted of using
	// opts.holder.node().querySelector() as used by most of the test scripts

	// genome select
	test.equal(spans[0].textContent, 'Genome', 'should have row for Genome')
	const genome_select = opts.holder.node().querySelector('select')
	test.equal(genome_select.querySelectorAll('option').length, 3, 'should have 3 options for genome select')

	// position
	test.equal(spans[1].textContent, 'Default position', 'should have row for position')

	// TODO: check all the components on the form inclusing buttons

	test.end()
})

tape('Check behavior of Example button', async test => {
	test.timeoutAfter(3000)
	const opts = await getOpts()

	const arg = {
		holder: opts.holder,
		genomes: opts.genomes,
		debug: 1
	}

	await init_mdsjsonform(arg)

	const buttons = opts.holder.node().querySelectorAll('button')
	const example_btn = buttons[3]

	example_btn.click()
	await sleep(200)

	const inputs = opts.holder.node().querySelectorAll('input')

	// check default position
	test.equal(
		inputs[0].value,
		'chr7:54990404-55375627',
		'should have default position changed to the one defined by example'
	)

	// check track name
	test.equal(
		inputs[1].value,
		'TCGA GBM somatic alterations',
		'should have track name changed to the one defined by example'
	)

	// TODO: Check all fields that should be updated after example button clicked
	test.end()
})
