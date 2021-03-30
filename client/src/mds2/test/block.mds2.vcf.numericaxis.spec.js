'use strict'
const tape = require('tape')
const serverconfig = require('../../../../serverconfig.json')
const host = 'http://localhost:' + serverconfig.port

/*************************
 reusable helper functions
**************************/

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- mds2 -***-')
	test.end()
})

/*
	NOTE: Only un-skip (enable) this test when it is done in isolation
	or until .sja_* can be selected uniquely for this mds2 track. 
	
	The document.body.querySelectorAll('.sja_*') conflicts with other tests
	that generate similarly-classed DOM tooltips or menus. Running this test with 
	other component specs will require being able to determine the particular
	tooltip or menu that is launched by this mds2 track.

*/
tape('AF Test: term tree menu', async test => {
	test.timeoutAfter(7000)

	const holder = document.body.appendChild(document.createElement('div'))
	const pp = await runproteinpaint({
		host,
		holder,
		noheader: 1,

		genome: 'hg38',
		block: true,

		tracks: [
			{
				type: 'mds2',
				dslabel: 'SJLife',
				// customizations to the official track
				vcf: {
					numerical_axis: {
						// customization canceled
						AFtest: {
							groups: [
								{
									is_termdb: true,
									filter: {
										type: 'tvslst',
										join: '',
										in: true,
										lst: [
											{
												type: 'tvs',
												tag: 'cohortFilter',
												renderAs: 'htmlSelect',
												selectOptionsFrom: 'selectCohort',
												tvs: {
													term: { id: 'subcohort', type: 'categorical' },
													values: [
														//{key:"SJLIFE",label:"SJLIFE"},
														{ key: 'CCSS', label: 'CCSS' }
													]
												}
											}
										]
									}
								},
								{ is_population: true, key: 'gnomAD', allowto_adjust_race: true, adjust_race: true }
							]
						}
					}
				}
			},
			{
				hidden: 1,
				type: 'mds2',
				name: 'test mds2',

				info_fields: [
					{
						key: 'QC',
						label: 'Good/Bad List',
						isfilter: true,
						isactivefilter: true,
						iscategorical: true,
						values: [
							{
								key: 'Good',
								label: 'Good'
							},
							{
								key: 'Bad',
								label: 'Bad',
								ishidden: true
							}
						]
					},
					{
						key: 'AF',
						label: 'SJLIFE allele frequency',
						isfilter: true,
						isfloat: 1,
						range: {
							startunbounded: true,
							//startinclusive: bool
							stop: 0.1,
							stopinclusive: true
						}
					},
					{
						key: 'gnomAD_AF',
						label: 'gnomAD allele frequency',
						isfilter: true,
						isactivefilter: true,
						isfloat: 1,
						range: {
							start: 0.1,
							startinclusive: true,
							stop: 1,
							stopinclusive: true
						}
					},
					{
						key: 'gnomAD_AF_afr',
						label: 'gnomAD African-American allele frequency',
						isfilter: true,
						isfloat: 1,
						range: {
							start: 0.1,
							startinclusive: true,
							stop: 1,
							stopinclusive: true
						}
					},
					{
						key: 'gnomAD_AF_eas',
						label: 'gnomAD East Asian allele frequency',
						isfilter: true,
						isfloat: 1,
						range: {
							start: 0.1,
							startinclusive: true,
							stop: 1,
							stopinclusive: true
						}
					},
					{
						key: 'gnomAD_AF_nfe',
						label: 'gnomAD non-Finnish European allele frequency',
						isfilter: true,
						isfloat: 1,
						range: {
							start: 0.1,
							startinclusive: true,
							stop: 1,
							stopinclusive: true
						}
					},
					{
						key: 'BadBLAT',
						isflag: true,
						isfilter: true,
						isactivefilter: true,
						remove_yes: true
					}
				],

				vcf: {
					file: 'files/hg38/sjlife/vcf/SJLIFE.vcf.gz',
					numerical_axis: {
						axisheight: 150,
						info_keys: [
							{
								key: 'AF',
								in_use: true
								// TODO bind complex things such as boxplot to one of the info fields
							},
							{ key: 'gnomAD_AF', missing_value: 0 },
							{ key: 'gnomAD_AF_afr', missing_value: 0 },
							{ key: 'gnomAD_AF_eas', missing_value: 0 },
							{ key: 'gnomAD_AF_nfe', missing_value: 0 }
						],
						in_use: true // to use numerical axis by default
					},
					plot_mafcov: {
						show_samplename: 1
					}
				}
			}
		],
		nativetracks: 'RefGene',
		noheader: true,
		nobox: true
	})

	await sleep(2300)
	test.equal(holder.querySelectorAll('.sja_aa_discg').length, 32, 'should have the expected number of p-value discs')
	test.equal(holder.querySelectorAll('.sja_filter_grp select').length, 1, 'should have a cohort selector')

	await sleep(300)
	const circle = holder.querySelector('.sja_aa_disckick')
	circle.dispatchEvent(new Event('click'))
	const pane = document.body.querySelector('#sja-pp-block-' + pp.block.blockId + '-0-vcf_clickvariant')
	await sleep(400) //; console.log(document.body.querySelector('.sja_pane'), [...document.body.querySelector('.sja_pane').querySelectorAll('.sja_menuoption')])
	const clininfobtn = [...pane.querySelectorAll('.sja_menuoption')].find(elem => elem.innerText == 'Clinical info')
	if (!clininfobtn) test.fail('should have clinical info button')
	else {
		clininfobtn.click()
		await sleep(400)
		test.equal(
			pane.querySelectorAll('.termdiv').length,
			5,
			'should have the expected number of root terms in the Clinical info tab'
		)
		test.equal(pane.querySelectorAll('select option').length, 3, 'should have the expected number of cohort options')
	}

	const mavplotbtn = [...pane.querySelectorAll('.sja_menuoption')].find(elem => elem.innerText == 'Coverage-MAF plot')
	if (!mavplotbtn) test.fail('should have Coverage-MAF plot button')
	else {
		mavplotbtn.click()
		await sleep(600)
		const selecttermbtn = pane.querySelector('.add_term_btn')
		if (!selecttermbtn) test.fail('should have a Select term button')
		else {
			selecttermbtn.click()
			await sleep(300)
			const treemenu = document.body.querySelector('#sja-pp-block-' + pp.block.blockId + '-0-mavcovplot-ts-tip')
			if (!treemenu) test.fail('should have a tree menu for the Coverage-MAV plot')
			else {
				test.equal(
					treemenu.querySelectorAll('.termdiv').length,
					5,
					'should have the expected number of root terms in the MAV plot Overlay term menu'
				)
			}
		}
	}

	test.end()
})
