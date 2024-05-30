# called from the proteinpaint directory

PPDIR=$(pwd)
HOOKS=$(git rev-parse --git-path hooks)
mv -f $HOOKS/pre-commit $HOOKS/pre-commit-bkup
cd $HOOKS
ls $PPDIR/utils/hooks/
ln -s $PPDIR/utils/hooks/post-checkout .
ln -s $PPDIR/utils/hooks/pre-commit .
ln -s $PPDIR/utils/hooks/commit-msg .
ln -s $PPDIR/utils/hooks/post-commit .
ln -s $PPDIR/utils/hooks/pre-push .
cd $PPDIR

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
