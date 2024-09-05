export type RxApp = {
	type: 'app'
	deregister: (api2: any) => void
	destroy: () => void
	dispatch: (action: any) => Promise<void>
	getComponents: (dotSepNames?: string) => any
	getState: () => any
	hasWebGL: () => boolean
	middle: (fxn: any) => void
	on: (eventType: string, callback: (event: any) => void) => void
	register: (api2: any) => void
	save: (action: any) => Promise<void>
}
