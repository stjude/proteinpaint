import path from 'path'

/*
Returns the text of an error from a library that reads a server file, such as @gmod/tabix, to reject with, as a
spawned tool rejected with its error output. The text may be sent to the client, so each absolute path in it,
such as of a file that cannot be opened, is replaced with its file name. A path of a url is kept, since it is
after the host of the url and not after a space or quote.
*/
export function libraryErrorText(e: unknown): unknown {
	if (!(e instanceof Error)) return e
	return e.message.replace(/(?<![\w:/.~-])\/[^\s'"`,;)]+/g, p => path.basename(p))
}
