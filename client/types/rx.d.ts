export type RxAppApi = {
	type: 'app'
	deregister: (api2: any) => void
	/** delete references to other objects to make it easier
	 * for automatic garbage collection to find unreferenced objects */
	destroy: () => void
	dispatch: (action: any) => Promise<void>
	getComponents: (dotSepNames?: string) => any
	/** return entire or selected state properties */
	getState: () => any
	hasWebGL: () => boolean
	middle: (fxn: any) => void
	on: (eventType: string, callback: (event: any) => void) => void
	register: (api2: any) => void
	/** save changes to store, do not notify components */
	save: (action: any) => Promise<void>
}
