import React from 'react'
import ReactDOM from 'react-dom'
import { AppProps } from './AppProps'
import { PpTrack } from '../PpReact'
import tape from 'tape'
import { select } from 'd3-selection'
import { getWindow } from '../../../test/fake.window'
// for local testing, a hardcopy of the serveronfig.json
// file is required at the project, for things like
// server port. This serverconfig file will need to be generated
// for tests in a container
import serverconfig from '../../../../serverconfig.json'

/*************************
 reusable helper functions
**************************/

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', test => {
	test.pass('-***- gdc/views.js -***-')
	test.end()
})

tape('lolliplot using props', async test => {
	test.timeoutAfter(35000)
	test.plan(5)
	const holder = select('body').append('div')
	const portal = ReactDOM.render(
		<AppProps basepath={`http://localhost:${serverconfig.port}`} geneId="ENSG00000142208" />,
		holder.node()
	)
	await sleep(5500)
	const akt1Circles = { min: 250, max: 300 }
	const akt1CirclesActual = holder.selectAll('circle').size()
	test.true(
		akt1CirclesActual > akt1Circles.min && akt1CirclesActual < akt1Circles.max,
		`should have between ${akt1Circles.min} and ${akt1Circles.max} circles on initial load with gene='AKT1', actual=${akt1CirclesActual}`
	)

	// click set_id checkbox
	const set_id_checkbox = holder.selectAll('#set_switch')
	set_id_checkbox.node().click()
	await sleep(6000)
	const akt1Set = { min: 200, max: 280 }
	const akt1SetActual = holder.selectAll('circle').size()
	test.true(
		akt1SetActual > akt1Set.min && akt1SetActual < akt1Set.max,
		`should have between ${akt1Set.min} and ${akt1Set.max} circles after applying set_id filter, actual=${akt1SetActual}`
	)

	// change gene
	const btns = holder.node().querySelectorAll('button')
	const kras_btn = btns[0]
	kras_btn.click()
	await sleep(5000)
	const krasSet = { min: 150, max: 220 }
	const krasSetActual = holder.selectAll('circle').size()
	test.true(
		krasSetActual > krasSet.min && krasSetActual < krasSet.max,
		`should have between ${krasSet.min} and ${krasSet.max} circles after changing gene to 'KRAS', actual=${krasSetActual}`
	)

	const filters = {
		op: 'AND',
		content: [{ op: 'IN', content: { field: 'cases.project.project_id', value: 'TCGA-GBM' } }]
	}
	portal.setState({ filters })
	await sleep(5000)
	const filteredCircles = { min: 1, max: 5 }
	const filteredActual = holder.selectAll('circle').size()
	test.true(
		filteredActual > filteredCircles.min && filteredActual < filteredCircles.max,
		`should have between ${filteredCircles.min} and ${filteredCircles.max} circles after applying filter, actual=${filteredActual}`
	)

	const disc = holder
		.selectAll('.sja_aa_disckick')
		.filter(d => d.occurrence == 2)
		.node()
	disc.dispatchEvent(new Event('click'))
	await sleep(3000)
	const g120 = disc.__data__.mlst && disc.__data__.mlst[0]
	const mname = g120.mname
	const links = [...document.querySelectorAll(`.sja_menu_div .sj_sampletable_holder a`)].filter(elem =>
		elem.innerHTML.startsWith('TCGA-')
	)
	const menudiv = links.length ? links[0].closest('.sja_menu_div') : null

	test.equal(
		menudiv &&
			[...menudiv.querySelectorAll('.sj_sampletable_holder a')].filter(elem =>
				elem.href.startsWith('https://portal.gdc.cancer.gov/cases/')
			).length,
		2,
		`should display a link to aliquot data when the corresponding disc and table entry is clicked`
	)
	test.end()
})

tape('lolliplot with ssm_id', async test => {
	test.timeoutAfter(30000)
	test.plan(1)
	const holder = select('body').append('div')
	const portal = ReactDOM.render(
		<AppProps basepath={`http://localhost:${serverconfig.port}`} ssm_id="4fb37566-16d1-5697-9732-27c359828bc7" />,
		holder.node()
	)
	await sleep(4000)
	test.equal(holder.selectAll('.sja_aa_discg rect').size(), 1, `should highlight the matching circle for props.ssm_id'`)

	test.end()
})

tape.only('lolliplot with ssm_id', async test => {
	test.timeoutAfter(30000)
	test.plan(1)
	const holder = select('body').append('div')
	const portal = ReactDOM.render(
		<PpTrack basepath={`http://localhost:${serverconfig.port}`} type="lolliplot" geneId="MYC" />,
		holder.node()
	)
	//await sleep(4000)
	test.fail('todo') //equal(holder.selectAll('.sja_aa_discg rect').size(), 1, `should highlight the matching circle for props.ssm_id'`)

	test.end()
})
