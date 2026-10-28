/** The number of plots of a violin or box plot chart that get the pairwise Wilcoxon tests, in one place so that the
 * client, which offers only what is allowed, and the server, which refuses a request past the limit, agree. */

/** The default, when the request does not set it */
export const defaultMaxPairwiseTestGroups = 8

/** The most plots that a request may set, since the number of pairs grows with the square of the number of plots */
export const pairwiseTestGroupsLimit = 30

/** The message for a chart whose pairwise tests are of its `maxGroups` largest plots only */
export function pairwiseTestMessage(maxGroups: number): string {
	return `Pair-wise tests are limited to the ${maxGroups} largest groups`
}
