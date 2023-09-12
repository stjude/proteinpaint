import { AbcResponse, AbcRequest }  from '../types/abc.ts'

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
			examples: [{
				request: null,
				response: {
					header: { status: 200 }
				}
			}]
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}
