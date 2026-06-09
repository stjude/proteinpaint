import tape from 'tape'
import { SCViewModel } from '../viewModel/SCViewModel.ts'
import { getMockSCApp, getMockSCConfig } from './getMockSCApp.ts'

/**
 * Tests
 *   - constructor should set tableData with rows, columns, and selectedRows
 *   - constructor should set selectedRows when item matches a sample
 *   - constructor should have empty selectedRows when no item is set
 *   - getTabelData() should create sample column as first column
 *   - getTabelData() should add sampleColumns when provided
 *   - getTabelData() should handle samples without experiments
 *   - getTabelData() should expand experiments into separate rows
 *   - getTabelData() should add GDC URL for experiment column when dslabel is GDC
 *   - getTabelData() should not add GDC URL for non-GDC datasets
 *   - getTabelData() should include sampleColumns with experiments
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/sc/viewModel/SCViewModel -***-')
	test.end()
})

tape('constructor should set tableData with rows, columns, and selectedRows', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig()
	const items = [{ sample: 'S1' }, { sample: 'S2' }]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	test.true(Array.isArray(vm.tableData.rows), 'Should have rows array')
	test.true(Array.isArray(vm.tableData.columns), 'Should have columns array')
	test.true(Array.isArray(vm.tableData.selectedRows), 'Should have selectedRows array')
	test.equal(vm.tableData.rows.length, 2, 'Should have one row per sample')
	test.end()
})

tape('constructor should set selectedRows when item matches a sample', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig({
		settings: {
			sc: { columns: { sample: 'Sample' }, item: { sID: 'S2', eID: '' } },
			hierCluster: {}
		}
	})
	const items = [{ sample: 'S1' }, { sample: 'S2' }, { sample: 'S3' }]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	test.deepEqual(vm.tableData.selectedRows, [1], 'Should select the matching sample index')
	test.end()
})

tape('constructor should have empty selectedRows when no item is set', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig()
	const items = [{ sample: 'S1' }]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	test.deepEqual(vm.tableData.selectedRows, [], 'Should have empty selectedRows')
	test.end()
})

tape('getTabelData() should create sample column as first column', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig({
		settings: {
			sc: { columns: { sample: 'Case' }, item: undefined },
			hierCluster: {}
		}
	})
	const items = [{ sample: 'S1' }]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	test.equal(vm.tableData.columns[0].label, 'Case', 'First column label should match config')
	test.equal(vm.tableData.columns[0].sortable, true, 'First column should be sortable')
	test.end()
})

tape('getTabelData() should add sampleColumns when provided', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig()
	const items = [{ sample: 'S1', sex: 'Male' }]
	const sampleColumns = [{ termid: 'sex', label: 'Sex' }]

	const vm = new SCViewModel(app.app, sampleColumns)
	vm.processData(config, items)

	test.equal(vm.tableData.columns.length, 3, 'Should have sample column + 1 extra column')
	test.equal(vm.tableData.columns[2].label, 'Sex', 'Extra column label should match')
	test.equal(vm.tableData.columns[2].sortable, true, 'Extra column should be sortable')
	const row = vm.tableData.rows[0] as any[]
	test.equal(row[2].value, 'Male', 'Row should include sample column value')
	test.end()
})

tape('getTabelData() should handle samples without experiments', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig()
	const items = [{ sample: 'S1' }, { sample: 'S2' }]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	test.equal(vm.tableData.columns.length, 2, 'Should only have the sample and shown plots columns')
	test.equal(vm.tableData.rows.length, 2, 'Should have one row per sample')
	const row0 = vm.tableData.rows[0] as any[]
	test.equal(row0[0].value, 'S1', 'First row value should be sample name')
	test.end()
})

tape('getTabelData() should expand experiments into separate rows', test => {
	const app = getMockSCApp({ vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } })
	const config = getMockSCConfig()
	const items = [
		{
			sample: 'Case1',
			experiments: [
				{ sampleName: 'exp_sample_1', experimentID: 'EXP1' },
				{ sampleName: 'exp_sample_2', experimentID: 'EXP2' }
			]
		}
	]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	test.equal(vm.tableData.rows.length, 2, 'Should create one row per experiment')
	// Columns: Sample, Sample (experiment sample name), Experiment
	test.equal(vm.tableData.columns.length, 4, 'Should have Sample + Shown plots + Sample + Experiment columns')
	test.equal(vm.tableData.columns[1].label, 'Sample', 'Second column should be Sample for experiment sample name')
	test.equal(vm.tableData.columns[3].label, 'Experiment', 'Third column should be Experiment')

	const row0 = vm.tableData.rows[0] as any[]
	test.equal(row0[0].value, 'Case1', 'Row should have case/sample name')
	test.equal(row0[0].__experimentID, 'EXP1', 'Row should sneak in experimentID')
	test.equal(row0[1].value, 'exp_sample_1', 'Row should have experiment sample name')
	test.equal(row0[3].value, 'EXP1', 'Row should have experiment ID')
	test.end()
})

tape('getTabelData() should add GDC URL for experiment column when dslabel is GDC', test => {
	const app = getMockSCApp({ vocab: { genome: 'hg38', dslabel: 'GDC' } })
	const config = getMockSCConfig()
	const items = [
		{
			sample: 'Case1',
			experiments: [{ sampleName: 'exp_s1', experimentID: 'FILE_UUID' }]
		}
	]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	const row0 = vm.tableData.rows[0] as any[]
	const expCell = row0[row0.length - 1]
	test.equal(expCell.url, 'https://portal.gdc.cancer.gov/files/FILE_UUID', 'Should include GDC file URL')
	test.end()
})

tape('getTabelData() should not add GDC URL for non-GDC datasets', test => {
	const app = getMockSCApp({ vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } })
	const config = getMockSCConfig()
	const items = [
		{
			sample: 'Case1',
			experiments: [{ sampleName: 'exp_s1', experimentID: 'EXP1' }]
		}
	]

	const vm = new SCViewModel(app.app)
	vm.processData(config, items)

	const row0 = vm.tableData.rows[0] as any[]
	const expCell = row0[row0.length - 1]
	test.equal(expCell.value, 'EXP1', 'Should have experiment ID value')
	test.equal(expCell.url, undefined, 'Should not have URL for non-GDC dataset')
	test.end()
})

tape('getTabelData() should include sampleColumns with experiments', test => {
	const app = getMockSCApp()
	const config = getMockSCConfig()
	const items = [
		{
			sample: 'Case1',
			sex: 'Female',
			experiments: [{ sampleName: 'exp_s1', experimentID: 'EXP1' }]
		}
	]
	const sampleColumns = [{ termid: 'sex', label: 'Sex' }]

	const vm = new SCViewModel(app.app, sampleColumns)
	vm.processData(config, items)

	// Columns: Sample, Sample (exp), Sex, Experiment
	test.equal(vm.tableData.columns.length, 5, 'Should have 5 columns')
	test.equal(vm.tableData.columns[3].label, 'Sex', 'Third column should be Sex')

	const row0 = vm.tableData.rows[0] as any[]
	test.equal(row0[3].value, 'Female', 'Row should include sample column value')
	test.end()
})
