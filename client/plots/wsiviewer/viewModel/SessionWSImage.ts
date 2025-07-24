import type { Annotation, WSImage } from '@sjcrh/proteinpaint-types'

export type SessionWSImage = WSImage & {
	sessionsAnnotations?: Annotation[]
}
