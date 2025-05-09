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

/** rx.getComponentInit() will set this.app, this.id, this.opts
 * Combine this pseudoclass with class to avoid type errors */
export class RxComponentInner {
	api: any
	app: any
	id: any
	opts: any
	state: any
	dom: {
		[index: string]: any
	}
}
