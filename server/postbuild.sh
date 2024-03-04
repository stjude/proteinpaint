#!/bin/bash

set -e

sed -i.bak 's|clinvar.ts|clinvar.mjs|g' dataset/clinvar.hg19.mjs
sed -i.bak 's|clinvar.ts|clinvar.mjs|g' dataset/clinvar.hg38.mjs
