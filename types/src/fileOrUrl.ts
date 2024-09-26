type FileNotURL = {
	/** File path from tp/ */
	file: string
	/** If file is provided, url should not be provided. Checked in validation type */
	url?: never
}

type URLNotFile = {
	/** If url is provided, file should not be provided. Checked in validation type */
	file?: never
	/** Remote file URL */
	url: string
}

export type FileORURL = FileNotURL | URLNotFile
