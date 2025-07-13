import tape from 'tape'
import * as d3s from 'd3-selection'
import { MassAbout } from '../about'

/* Tests

    Default About tab class
    .initCohort()
    .initCohort() - .selectCohort content and .about.html
    .initCustomHtml()
	.initActiveItems()

TODO:
    - initCohort
    - renderCohortsTable
    - showServerInfo
*/

/**************
 helper functions
***************/

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
}

function getAbout(opts) {
	const _opts = {
		app: {
			opts: {
				pkgver: '1.0.0',
				launchDate: 'Wed Oct 09 2024'
			}
		},
		instanceNum: 1,
		subheader: opts.holder
	}

	return new MassAbout(Object.assign(_opts, opts))
}

const mockAppState = {
	activeCohort: 0
}

const mockCohort = {
	title: 'Test Cohort Title',
	prompt: 'Select a cohort and test the plots.',
	description: 'Select cohort description',
	values: [
		{
			keys: ['ABC'],
			label: 'ABC Cohort (ABC)',
			shortLabel: 'ABC',
			isdefault: true
		},
		{
			keys: ['XYZ'],
			label: 'XYZ Cohort (XYZ)',
			shortLabel: 'XYZ'
		}
	]
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- mass/about -***-')
	test.end()
})

tape('Default About tab class', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const mockAbout = getAbout({ holder })

	test.equal(mockAbout.type, 'about', 'Should set component type to about')
	test.equal(mockAbout.instanceNum, 1, 'Should set instance number to 1')
	test.equal(mockAbout.subheader, holder, 'Should set subheader to holder')
	test.equal(typeof mockAbout.initCohort, 'function', 'Should have a mockAbout.initCohort() function')
	test.equal(typeof mockAbout.initCustomHtml, 'function', 'Should have a mockAbout.initCustomHtml() function')
	test.equal(typeof mockAbout.renderCohortsTable, 'function', 'Should have a mockAbout.initCustomHtml() function')
	test.equal(typeof mockAbout.showServerInfo, 'function', 'Should have a mockAbout.showServerInfo() function')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('.initCohort()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const opts = {
		holder,
		selectCohort: mockCohort
	}

	const mockAbout = getAbout(opts)
	mockAbout.initCohort(mockAppState)

	test.true(
		mockAbout.dom.cohortTitle && mockAbout.dom.cohortTitle.node()!.textContent == opts.selectCohort.title,
		'Should render cohort tile'
	)

	test.true(
		mockAbout.dom.cohortPrompt && mockAbout.dom.cohortPrompt.node()!.textContent == opts.selectCohort.prompt,
		'Should render cohort prompt'
	)
	test.true(mockAbout.dom.cohortPrompt && mockAbout.dom.cohortOpts!.node()!, 'Should create a div for cohort table')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('.initCohort() - .selectCohort content and .about.html', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const opts = {
		holder,
		selectCohort: {
			description: 'Select cohort description',
			values: [
				{
					keys: ['ABC'],
					label: 'ABC Cohort (ABC)',
					shortLabel: 'ABC',
					isdefault: true
				}
			]
		},
		aboutOverride: {
			html: 'Test'
		}
	}

	const mockAbout = getAbout(opts)
	mockAbout.initCohort(mockAppState)

	test.true(
		mockAbout.subheader.select('[data-testid="sjpp-about-cohort-desc"]').node(),
		'Should render cohort description'
	)
	test.true(
		!mockAbout.subheader.select('[data-testid="sjpp-custom-about-content"]').node(),
		'Should not render custom about content when .selectCohort is provided.'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('.initCustomHtml()', test => {
	test.timeoutAfter(100)

	const holder = getHolder() as any
	const opts = {
		holder,
		aboutOverrides: {
			html: 'Test'
		}
	}

	const mockAbout = getAbout(opts)
	mockAbout.initCustomHtml()

	test.true(
		mockAbout.subheader.select('[data-testid="sjpp-custom-about-content"]').node(),
		'Should render custom about content'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('.initActiveItems()', test => {
	test.timeoutAfter(100)

	const itemTitle = 'abc'

	const holder = getHolder() as any
	const opts = {
		holder,
		aboutOverrides: {
			activeItems: {
				items: [
					{
						title: itemTitle
					}
				]
			}
		}
	}

	const mockAbout = getAbout(opts)
	mockAbout.initActiveItems()

	// type any avoids tsc err: 'itemNode' is possibly 'null'
	const itemNode: any = mockAbout.subheader.select('[data-testid="sjpp-custom-about-activeItems"]').node()

	test.true(itemNode, 'Should render a node as activeItem')
	test.equal(itemNode.firstChild.innerHTML, itemTitle, 'activeItem first child dom prints correct item title')

	if (test['_ok']) holder.remove()
	test.end()
})
