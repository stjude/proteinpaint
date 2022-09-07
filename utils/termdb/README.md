# Termdb Utility Scripts 

## Files

- buildTermdb.js: a general purpose pipeline to build SQLite database,
  using input files for dictionary and sample anntation contents.
- *.sql: various SQL scripts that fully define the database table structure and indexing
- reheader.py: used for datasets with BCF/tabix files


## Build 

To run the pipeline, first generate a webpack bundle:

```bash
npx webpack
```

This yields script "buildTermdb.bundle.js".

## Usage

You can run this script from anywhere on your computer.
However, it is recommended to create softlinks in the tp/ directory,
for ease of use.

### Recommended symlinks

```bash
# this initial symlink is only only in your developer machine, not in ppr
cd your/tp/
ln -s path/to/proteinpaint/utils/termdb .

# Set up the following symlinks in ppr and your developer machine.
# In each data directory where you'd like to use these scripts
cd your/tp/path/to/input/data
ln -s your/tp/buildTermdb.bundle.js .
ln -s your/tp/reheader.py .
```

### Usage 1: Build db with dictionary and sample annotation.

```bash
# if you've set up softlinks as recommended above
node ./buildTermdb.bundle.js terms=path/to/terms.txt annotation3Col=path/to/annotations.txt survival=path/to/survival.txt
```

This generates a database file named "db.runId", and integer-to-string sample name mapping "sampleidmap.runId"

If the dataset has BCF or tabix files that contains string sample names,
must reheader these files using "sampleidmap",
to generate new BCF/tabix files using integer sample IDs.

```bash
cd your/tp/path/to/input/data
$ python3 reheader.py --bcf path/to/bcf_file --fusion path/to/fusion_file --sample path/to/sampleIdMatchFile --out_bcf reheadered_bcf --out_fusion reheadered_fusion
```

### Usage 2: Build dictionary-only db.

```bash
$ node path/to/buildTermdb.bundle.js phenotree=path/to/phenotree.txt
```

This generates only a db file.

## Deploy

To share the pipeline with people outside the team, do below:
```bash
./deploy.sh
```

This deposites latest bundle and sql scripts at the "tp/" folder on HPC.
Follow the instructions for "Recommended symlinks" in your data directories in hpc:~/tp.
