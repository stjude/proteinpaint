#!/bin/bash

# called from the proteinpaint directory

PPDIR=$(pwd)
HOOKS=$(git rev-parse --git-path hooks)
cd $HOOKS
ls $PPDIR/utils/hooks/
# links a tracked hook, after moving an existing hook that is not a link to a backup,
# without replacing an earlier backup
link() {
	if [[ -f $1 && ! -L $1 ]]; then
		BKUP=$1-bkup
		if [[ -e $BKUP ]]; then BKUP=$1-bkup-$(date +%Y%m%d%H%M%S); fi
		mv $1 $BKUP
		echo "moved the existing $1 hook to $BKUP"
	fi
	ln -sf $PPDIR/utils/hooks/$1 .
}
link post-checkout
link pre-commit
link commit-msg
link post-commit
link pre-push
link reference-transaction
cd $PPDIR

# optional private terms for check-text.sh, when this repo is checked out within sjpp
TERMS="$(dirname $PPDIR)/security-triage/text-check-terms.txt"
if [[ -f "$TERMS" ]]; then
    git config pp.textCheckTerms "$TERMS"
fi

STATUS="$(which pre-commit)"
if [[ "$STATUS" == "" || "$STATUS" == "pre-commit not found" ]]; then 
    echo "installing the pre-commit utility using pip3"
    pip3 install pre-commit --break-system-packages --user
    echo "setting the global pre-commit template directory"
    git config --global init.templateDir ~/.git-template
    pre-commit init-templatedir ~/.git-template
    
    # not everyone has access to this repo, seems to be private
    # if [[ ! -d "verify-pre-commit" ]]; then
    #     echo "clong the verify-pre-commit repo ..."
    #     git clone git@github.com:NCI-GDC/verify-pre-commit.git
    # fi
    # cd verify-pre-commit
    # echo "verifying installation ..."
    # ./verify-pre-commit-global.sh
    # cd ..
    # rm -rf verify-pre-commit
fi
