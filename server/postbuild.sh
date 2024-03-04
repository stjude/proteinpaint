#!/bin/bash

set -e

sed -i '' 's|clinvar.ts|clinvar.js|g' dataset/clinvar.hg19.js
sed -i '' 's|clinvar.ts|clinvar.js|g' dataset/clinvar.hg38.js
