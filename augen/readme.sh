#!/bin/bash

# call from the proteinpaint project root dir

md=$(find . -type f -name "*.md" -not -path "**/tmp*/*" -not -path '**/node_modules*/*')
parentModule=''

if [[ -d '../.git/modules/proteinpaint' ]];then
	extra=$(find .. -type f -name '*.md' -not -path '**/proteinpaint/*' -not -path '**/tmp*/*' -not -path '**/node_modules*/*' -not -path '**/.*/*')
	md="$md\n$extra"''
	parentModule=$(node -p "('$PWD').split('/').slice(-2,-1)[0]")
fi


echo $(node -p "JSON.stringify({readmes: (\`$md\`).split('\n').filter(f => !f.includes('.github') && !f.includes('fonts')).map(f=>f.startsWith('./') ? f.replace('./', '') : f), parentModule: '$parentModule'})")