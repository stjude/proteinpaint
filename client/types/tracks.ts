/** The bare minimum arguments required for runproteinpaint() */
export type BaseRunProteinPaintArgs = {
	holder: string
	hostURL: string
	genome: string
}

/** The bare minimum args required to create the track in the block code
 * TODO: name is ambigious. Suggestions to rename?
 */
export type BaseBlockArgs = {
	genome: string
}

export type BaseTrackArgs = {
	callbackOnRender?: (tk?: any, bb?: any) => void
}
