import type { TileSelection, WSImage } from '@sjcrh/proteinpaint-types'

export type SessionWSImage = WSImage & {
	sessionsTileSelections?: TileSelection[]
}
