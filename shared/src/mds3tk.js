// this script should contain mds3 track-related stuff shared between client and backend

/*
the separator is used to join essential bits of a variant obj into a string as the "ssm_id", aims to uniquely identify a variant irrespective of sample
this is to mimic the GDC "ssm_id" which is a random id, with below benefits:
- consistent way to pass request body for both gdc and non-gdc
- uniform identification of ssm/cnv/sv in non-gdc backend code
- uniform identification of all variants in client

ssm: chr + pos + ref + alt
cnv:  chr + start + stop + class
svfusion: dt + chr + pos + strand + pairlstidx + mname

the separator must avoid conflicting with characters from gene names, and can be changed based on needs
*/
export const ssmIdFieldsSeparator = '__'
