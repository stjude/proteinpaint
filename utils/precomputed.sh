#!/bin/bash
DB=$1
TSV=$2

sqlite3 -batch $DB <<EOF
DROP TABLE IF EXISTS precomputed;
CREATE TABLE precomputed(
  sample TEXT,
  term_id TEXT,
  value_for TEXT,
  value TEXT,
  restriction TEXT
);
CREATE INDEX p_sample on precomputed(sample);
CREATE INDEX p_termid on precomputed(term_id);
CREATE INDEX p_value_for on precomputed(value_for);
CREATE INDEX p_restriction on precomputed(restriction);
.mode tabs
.import "$TSV" precomputed
EOF