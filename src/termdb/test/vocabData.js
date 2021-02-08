const terms = [
	{
		id: 'a',
		name: 'AAA',
		parent_id: null
	},
	{
		id: 'b',
		name: 'BBB',
		parent_id: null
	},
	{
		type: 'categorical',
		id: 'c',
		name: 'CCC',
		parent_id: 'a',
		isleaf: true,
		groupsetting: {
			disabled: true
		},
		values: {
			1: { label: 'Yes' },
			0: { label: 'No' }
		}
	},
	{
		type: 'float',
		id: 'd',
		name: 'DDD',
		parent_id: 'a',
		isleaf: true,
		bins: {
			default: {
				bin_size: 0.2,
				stopinclusive: true,
				first_bin: { startunbounded: true, stop: 0.2, stopinclusive: true }
			}
		}
	},
	{
		type: 'condition',
		id: 'e',
		name: 'EEE',
		parent_id: 'a',
		isleaf: true,
		groupsetting: {
			disabled: true
		}
	},
	{
		type: 'categorical',
		id: 'f',
		name: 'FFF',
		parent_id: 'b',
		isleaf: true,
		groupsetting: {
			disabled: true
		},
		values: {
			1: { label: 'Yes' },
			0: { label: 'No' }
		}
	},
	{
		type: 'categorical',
		id: 'g',
		name: 'CCC',
		parent_id: 'ab',
		isleaf: true,
		groupsetting: {
			disabled: true
		},
		values: {
			1: { label: 'Yes' },
			0: { label: 'No' }
		}
	}
]

exports.terms = terms

const vocab = JSON.stringify({
	route: null,
	terms,
	sampleannotation: {
		1: {
			c: 1,
			d: 0.1
		},
		2: {
			c: 0,
			d: 0.5
		},
		3: {
			c: 1,
			d: 0.8
		},
		4: {
			c: 1,
			d: 0.2
		},
		5: {
			c: 0,
			d: 0.4
		},
		6: {
			c: 1,
			d: 0.3
		},
		7: {
			c: 0,
			d: 0.5
		},
		8: {
			c: 1,
			d: 0.9
		},
		9: {
			c: 0,
			d: 0.05
		},
		10: {
			c: 1,
			d: 1.1
		}
	}
})

exports.getExample = () => {
	return JSON.parse(vocab)
}
