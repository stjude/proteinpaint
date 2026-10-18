/*
Patterns of genomic coordinates that the specs share.
*/

/** a chromosome name, which does not start with "-" */
export const chrPattern = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,99}$/

/** chr:start-stop, as tabix and samtools faidx read a region */
export const regionPattern = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,99}:\d{1,12}-\d{1,12}$/
