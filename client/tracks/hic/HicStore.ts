import { getStoreInit } from '#rx'

class HicStore {
	type: 'store'
	defaultState: {
		defaultNmeth: string
		loading: boolean
		readonly minBinNum_bp: 200
		readonly minCanvasSize: 800
		readonly initialBinNum: 20
		settings: {
			widthHeightPx: number
		}
	}
	actions: any
	state: any
	readonly views = ['genome', 'chrpair', 'detail', 'horizontal']

	constructor() {
		this.type = 'store'
		this.defaultState = {
			defaultNmeth: 'NONE',
			loading: true,
			minBinNum_bp: 200,
			initialBinNum: 20,
			minCanvasSize: 800,
			settings: {
				widthHeightPx: 800
			}
		}
	}
}

export const hicStoreInit = getStoreInit(HicStore)

HicStore.prototype.actions = {
	view_create(action: { view: string; config: any }) {
		if (!action.view) throw Error('view_create: missing view')
		if (!this.views.some((v: string) => v == action.view)) throw Error(`view_create: unknown view = ${action.view}`)
		this.state.currView = action.view
		const opts = Object.assign(this.state, action.config)
		this.state = opts
	},
	view_update(action: { view?: string; config: any }) {
		if (action.view) {
			//Target only a specific view
			if (!this.views.some((v: string) => v == action.view)) throw Error(`view_update: unknown view = ${action.view}`)
			const opts = Object.assign(this.state[action.view], action.config)
			this.state[action.view] = opts
		} else {
			//Update any value of the state
			const opts = Object.assign(this.state, action.config)
			this.state = opts
		}
	},
	loading_active(action: { active: boolean }) {
		this.state.loading = action.active
	}
}
