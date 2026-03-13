import tape from 'tape'
import { getSamplesRelated } from '../sampleView'

/***
test sections:

getSamplesRelated()
*/

tape('\n', test => {
	test.comment('-***- plots/sampleView unit -***-')
	test.end()
})

tape('getSamplesRelated() includes sibling branches', test => {
	// Hierarchy: 1_patient (ROOT) → 1, 101, 102
	//            1 → 5 → 9 → 13
	const ROOT_SAMPLE_TYPE = 'root'
	const samplesData: Record<string, any> = {
		'1_patient': { id: 0, name: '1_patient', ancestor_id: undefined, ancestor_name: undefined, sample_type: ROOT_SAMPLE_TYPE },
		'1': { id: 1, name: '1', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' },
		'5': { id: 5, name: '5', ancestor_id: 1, ancestor_name: '1', sample_type: 'default' },
		'9': { id: 9, name: '9', ancestor_id: 5, ancestor_name: '5', sample_type: 'default' },
		'13': { id: 13, name: '13', ancestor_id: 9, ancestor_name: '9', sample_type: 'default' },
		'101': { id: 101, name: '101', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' },
		'102': { id: 102, name: '102', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' }
	}

	// When searching from sample '1', the chain 1>5>9>13 should be found first,
	// followed by siblings 101 and 102 (direct children of 1_patient not in the chain).
	const result = getSamplesRelated(samplesData, '1')
	const names = result.map((s: any) => s.sampleName)

	test.ok(names.includes('1'), 'should include sample 1')
	test.ok(names.includes('5'), 'should include sample 5')
	test.ok(names.includes('9'), 'should include sample 9')
	test.ok(names.includes('13'), 'should include sample 13')
	test.ok(names.includes('101'), 'should include sibling sample 101')
	test.ok(names.includes('102'), 'should include sibling sample 102')
	test.equal(names.length, 6, 'should return exactly 6 samples for 1_patient')

	// The main chain should appear before the sibling branches
	test.ok(names.indexOf('1') < names.indexOf('101'), 'chain sample 1 should appear before sibling 101')
	test.ok(names.indexOf('13') < names.indexOf('101'), 'chain end 13 should appear before sibling 101')

	test.end()
})

tape('getSamplesRelated() returns correct chain order', test => {
	const ROOT_SAMPLE_TYPE = 'root'
	const samplesData: Record<string, any> = {
		'1_patient': { id: 0, name: '1_patient', ancestor_id: undefined, ancestor_name: undefined, sample_type: ROOT_SAMPLE_TYPE },
		'1': { id: 1, name: '1', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' },
		'5': { id: 5, name: '5', ancestor_id: 1, ancestor_name: '1', sample_type: 'default' },
		'9': { id: 9, name: '9', ancestor_id: 5, ancestor_name: '5', sample_type: 'default' },
		'13': { id: 13, name: '13', ancestor_id: 9, ancestor_name: '9', sample_type: 'default' },
		'101': { id: 101, name: '101', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' },
		'102': { id: 102, name: '102', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' }
	}

	const result = getSamplesRelated(samplesData, '1')
	const names = result.map((s: any) => s.sampleName)

	// Chain order: 1 > 5 > 9 > 13 (ancestors first, descendants last)
	test.ok(names.indexOf('1') < names.indexOf('5'), 'sample 1 should come before 5')
	test.ok(names.indexOf('5') < names.indexOf('9'), 'sample 5 should come before 9')
	test.ok(names.indexOf('9') < names.indexOf('13'), 'sample 9 should come before 13')

	test.end()
})

tape('getSamplesRelated() with leaf node includes all patient samples', test => {
	const ROOT_SAMPLE_TYPE = 'root'
	const samplesData: Record<string, any> = {
		'1_patient': { id: 0, name: '1_patient', ancestor_id: undefined, ancestor_name: undefined, sample_type: ROOT_SAMPLE_TYPE },
		'1': { id: 1, name: '1', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' },
		'5': { id: 5, name: '5', ancestor_id: 1, ancestor_name: '1', sample_type: 'default' },
		'9': { id: 9, name: '9', ancestor_id: 5, ancestor_name: '5', sample_type: 'default' },
		'13': { id: 13, name: '13', ancestor_id: 9, ancestor_name: '9', sample_type: 'default' },
		'101': { id: 101, name: '101', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' },
		'102': { id: 102, name: '102', ancestor_id: 0, ancestor_name: '1_patient', sample_type: 'default' }
	}

	// When searching from sample '101' (a leaf node sibling), all patient samples should be returned
	const result = getSamplesRelated(samplesData, '101')
	const names = result.map((s: any) => s.sampleName)

	test.ok(names.includes('101'), 'should include sample 101')
	test.ok(names.includes('1'), 'should include sibling 1')
	test.ok(names.includes('102'), 'should include sibling 102')
	test.ok(names.includes('5'), 'should include descendant 5 of sibling 1')
	test.ok(names.includes('9'), 'should include descendant 9 of sibling 1')
	test.ok(names.includes('13'), 'should include descendant 13 of sibling 1')
	test.equal(names.length, 6, 'should return all 6 patient samples')

	test.end()
})

tape('getSamplesRelated() with no siblings returns only chain', test => {
	const ROOT_SAMPLE_TYPE = 'root'
	const samplesData: Record<string, any> = {
		patient_A: { id: 0, name: 'patient_A', ancestor_id: undefined, ancestor_name: undefined, sample_type: ROOT_SAMPLE_TYPE },
		sampleX: { id: 10, name: 'sampleX', ancestor_id: 0, ancestor_name: 'patient_A', sample_type: 'default' },
		sampleY: { id: 20, name: 'sampleY', ancestor_id: 10, ancestor_name: 'sampleX', sample_type: 'default' }
	}

	const result = getSamplesRelated(samplesData, 'sampleX')
	const names = result.map((s: any) => s.sampleName)

	test.ok(names.includes('sampleX'), 'should include sampleX')
	test.ok(names.includes('sampleY'), 'should include sampleY')
	test.equal(names.length, 2, 'should return exactly 2 samples when no siblings exist')

	test.end()
})
