function init() {
	return (req, res) => {
		res.send({ status: 'ok' })
	}
}

export const api = {
	endpoint: 'abc',
	methods: {
		get: {
			init,
			request: {
				typeId: 'AbcRequest'
				//valid: default to type checker
			},
			response: {
				typeId: 'AbcResponse'
				// will combine this with type checker
				//valid: (t) => {}
			},
			examples: []
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}
