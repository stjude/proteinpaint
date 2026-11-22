_This is a draft document_

Add important technical details here.

## Caching and the "download all genes" table

The server code is in `server/src/grin2/main.ts`. Files are kept in the `grin2` folder of the server's cache directory.

### What one analysis writes

A GRIN2 run computes statistics for every gene, but the response sends only the top genes. The run leaves two files:

- `<cacheId>.json`: the statistics and the processing summary. The next request with the same inputs reads this file
  instead of computing again.
- a `.tsv` file with every gene's row. The "download all genes" menu line downloads this file.

The **cache id** is a hash of the inputs that decide the statistics: the genome, the dataset, the cohort filters, the
data type options, the exclude options, `maxGenesToShow`, and a `statsVersion` number (see `grin2KeyInputs()`). Plot
size and colors are not part of it, so changing them uses the cached statistics, and only the plot is drawn again.

### Reduced runs are not cached

When server memory is low, a run uses a lower lesion cap than the configured one. If the run reaches that lower cap,
some lesions were left out, so its statistics are not the full result. We call this a **reduced run**. Its statistics
are not saved to `<cacheId>.json`, so a later request with more memory computes the full result.

### Each run's table has an id

Every analysis response carries a `fullTableId`, which names that run's table:

| Run | `fullTableId` | Table file |
| --- | --- | --- |
| Cached run | the cache id | `<cacheId>.tsv` |
| Reduced run | the cache id, a dash, and 16 random hex digits | `<cacheId>-<16 hex>.tsv` |

A reduced run needs its own name because it is not cached. Someone else who runs the same request computes again, and
that run writes its own table. If both tables had the same name, the second run would overwrite the first one. The
first user would then download statistics that do not match the results on their screen. With a name for each run,
nothing can overwrite a reduced run's table.

### Downloading the table

The client keeps the request that made the displayed results. "Download all genes" sends that request again with
`exportFullTable: true` and the response's `fullTableId`. The server then:

1. Checks that the id starts with the cache id of the request, so a request can only read a table of the analysis it
   describes. The id must also be the cache id, or the cache id followed by a dash and 16 hex digits. Any other id is
   refused before the server touches a file.
2. Sends the table with that id if it is there. The binary writes the table to a temporary file and then renames it,
   so a table that is there is never half-written.
3. If the table is gone:
   - **Reduced run:** the server returns an error asking the user to run the analysis again. It does not compute
     again, because a new run could use another lesion cap and give different numbers.
   - **Cached run:** the server deletes the cached statistics and computes again, which writes both files again. If
     memory is low now and the new run is a reduced one, its table would not match either, so this also returns the
     error.

### When the file cache is disabled

With `features.disableFileCache` in the server config, nothing is kept on disk. The response has no `fullTableId`, so
the client does not show the "download all genes" line, and the server refuses an export request.

### When files are removed

The cache sweep (`server/src/CacheManager.ts`) removes old files in the `grin2` folder one at a time, by age and by
total size. A table can therefore be removed before or after its statistics. Step 3 above handles both cases. Each
reduced run leaves one more table, and the sweep removes those like any other file.

### Changing the statistics

When a change to the statistics or the table changes what a run writes, increase `statsVersion` in `grin2KeyInputs()`.
That changes every cache id, so files written by the old code are never read again. The sweep removes them later.
