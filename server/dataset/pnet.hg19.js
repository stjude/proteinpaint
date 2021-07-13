module.exports = {
	isMds: true,

	cohort: {
		db: {
			file: 'files/hg19/pnet/clinical/db'
		},

		termdb: {
			survivalplot: {
				term_ids: ['Event-free survival', 'Overall survival'],
				xUnit: 'days',
				// terms: [], // will be filled in termd.server_init_db_queries
				codes: [{ value: 0, name: '' }, { value: 1, name: 'censored' }]
			}
		}
	}
}
