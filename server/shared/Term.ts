import { nonDictionaryTermTypes } from './termdb.usecase.js'

export class Term {
	id: string
	name: string
	type: string
	constructor(id: string, name: string, type: string) {
		this.id = id
		this.name = name
		this.type = type
	}

	static fromJson(json: any): Term {
		return new Term(json.id, json.name, json.type)
	}

	toJson(): any {
		return {
			id: this.id,
			name: this.name,
			type: this.type
		}
	}

	toString(): string {
		return this.name
	}

	equals(other: Term): boolean {
		return this.id === other.id
	}

	isDictionaryTerm(): boolean {
		return !nonDictionaryTermTypes.has(this.type)
	}

	getTermWrapper(): TermWrapper {
		return new TermWrapper(this)
	}
}
