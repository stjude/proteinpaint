# must have an /opt/app/pp directory
if [[ ! -d "/opt/app/pp/" ]]; then
	sudo mkdir -p /opt/app/pp
fi

if [[ ! -d "/opt/app/pp/active" ]]; then
	sudo mkdir /opt/app/pp/active
fi

if [[ ! -d "/opt/data/pp/pp-log" ]]; then
	sudo mkdir -p /opt/data/pp/pp-log
	sudo chmod 777 /opt/data/pp/pp-log
fi


PPDIR=~/dev/proteinpaint
cd /opt/app/pp
sudo ln -sfn $PPDIR/build/sj/helpers .
sudo ln -sfn $PPDIR/build/sj/helpers/proteinpaint_run_node.sh .
sudo ln -sfn $PPDIR/build/sj/helpers/ppstop.js .

cd active
sudo ln -sfn $PPDIR/serverconfig.json .
sudo ln -sfn $PPDIR/server/server.js .
sudo ln -sfn $PPDIR/server/dataset .
sudo ln -sfn $PPDIR/server/genome .
sudo ln -sfn $PPDIR/server/src .
sudo ln -sfn $PPDIR/server/utils .
sudo ln -sfn $PPDIR/public .
