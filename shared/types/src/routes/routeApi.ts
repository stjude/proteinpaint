export type RouteApi = {
	endpoint: string
	methods: {
		get?: RoutePayload
		post?: RoutePayload
		put?: RoutePayload
		delete?: RoutePayload
	}
}

export type RoutePayload = {
	init?: RouteInit
	request: RouteMethod
	response: RouteMethod
	/** if examples are not provided, will not test */
	examples?: PayloadExample[]
}
export type RouteMethod = {
	typeId: string
	checker?: any
}
/* later replace actual values */
export type Point = {
	x: string
	y: string | number
}

type RouteInitArg = {
	app: any
	genome: any
	genomes: any
}
type RouteHandler = (req: any, res: any) => void
type RouteInit = (a: RouteInitArg) => RouteHandler
type PayloadExample = {
	request: {
		body: any
	}
	response?: {
		header?: any
		/**
		 * if omitted, only payload shape is checked at runtime;
		 * if provided, will use deep equal to check at runtime
		 */
		body?: any
	}
}
