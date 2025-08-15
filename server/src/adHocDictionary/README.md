# Building an ad hoc termdb
For datasets receiving metadata via api, an ad hoc dictionary can be created on server init (server/src/mds3.init.js). These ad hoc dictionaries are designed to return term objects and use the existing termdb vocab queries. 

To init, the following must be in the dataset file: 
```
cohort: {
    termdb: {
        dictionary: {
            aiApi: true,
            source: {
                file: //path,
                sampleKey: //matches the col header of the sample key
            }
        }...
    }
}
```
## Build
The build helpers create the term objects stored in memory. 

## Filtering
The filter helpers assume a termdb filter object is passed from the client. For easier use, the filter is normalized for the remaining helpers. 