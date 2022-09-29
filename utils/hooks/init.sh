# called from the proteinpaint directory

mv -f .git/hooks/pre-commit .git/hooks/pre-commit-bkup
cd .git/hooks
ln -s ../../utils/hooks/pre-commit pre-commit
cd ../..

STATUS=which pre-commit
if [[ "$STATUS" == "" || "$STATUS" == "pre-commit not found" ]]; then 
    echo "installing the pre-commit utility using pip3"
    pip3 install pre-commit
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
