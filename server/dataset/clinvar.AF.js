module.exports = {
	AF_EXAC: {
		name: 'ExAC frequency',
		locusinfo: { key: 'AF_EXAC' },
		numericfilter: [{ side: '<', value: 0.0001 }, { side: '<', value: 0.001 }, { side: '<', value: 0.01 }]
	},
	AF_ESP: {
		name: 'GO-ESP frequency',
		locusinfo: { key: 'AF_ESP' },
		numericfilter: [{ side: '<', value: 0.0001 }, { side: '<', value: 0.001 }, { side: '<', value: 0.01 }]
	},
	AF_TGP: {
		name: '1000 Genomes frequency',
		locusinfo: { key: 'AF_TGP' },
		numericfilter: [{ side: '<', value: 0.0001 }, { side: '<', value: 0.001 }, { side: '<', value: 0.01 }]
	}
}
