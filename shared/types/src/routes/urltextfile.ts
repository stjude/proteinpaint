export type UrltextfileRequest = {
	/** url of a text file that the server fetches and returns */
	url: string
}

export type UrltextfileResponse = {
	/** text of the file, with any js script stripped */
	text?: string
	error?: string
}
