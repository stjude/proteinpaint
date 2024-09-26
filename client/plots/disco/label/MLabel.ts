import { mclass } from '#shared/common.js'
export default class MLabel {
	private static instance: MLabel
	readonly mlabel

	/**
	 * The Singleton's constructor should always be private to prevent direct
	 * construction calls with the `new` operator.
	 */
	private constructor() {
		const mlabel = {}
		for (const key in mclass) {
			mlabel[mclass[key].label] = mclass[key]
			mlabel[key] = mclass[key]
		}

		this.mlabel = mlabel
	}

	/**
	 * The static method that controls the access to the singleton instance.
	 *
	 * This implementation let you subclass the Singleton class while keeping
	 * just one instance of each subclass around.
	 */
	public static getInstance(): MLabel {
		if (!MLabel.instance) {
			MLabel.instance = new MLabel()
		}

		return MLabel.instance
	}
}
