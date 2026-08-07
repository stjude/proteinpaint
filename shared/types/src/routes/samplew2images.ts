import type { WSImage } from './samplewsimages.ts'

/** Slim request for the w2 viewer: the samplewsimages route only reads these
 three fields (SampleWSImagesRequest also declares wsimage, which it ignores). */
export type SampleW2ImagesRequest = {
	genome: string
	dslabel: string
	sample_id: string
}

/** The subset of WSImage fields the w2 viewer reads; the routes return more
 (id, predictionLayers, uncertainty, activePatchColor) for other consumers. */
export type W2Image = Pick<WSImage, 'filename' | 'metadata' | 'annotations' | 'predictions' | 'classes' | 'tileSize'>

export type SampleW2ImagesResponse = {
	sampleWSImages: W2Image[]
}
