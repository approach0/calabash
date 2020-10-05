#!/bin/sh
REGISTRY=$1

sed -i s@/deb.debian.org/@/mirrors.aliyun.com/@g /etc/apt/sources.list
apt-get update

link1=http://mirrors.aliyun.com/docker-ce/linux/debian/dists/buster/pool/stable/amd64/containerd.io_1.3.7-1_amd64.deb
link2=http://mirrors.aliyun.com/docker-ce/linux/debian/dists/buster/pool/stable/amd64/docker-ce-cli_19.03.9~3-0~debian-buster_amd64.deb
link3=http://mirrors.aliyun.com/docker-ce/linux/debian/dists/buster/pool/stable/amd64/docker-ce_19.03.9~3-0~debian-buster_amd64.deb

install() {
	url=$1
	fname=`basename $1`
	if [ ! -e $fname ]; then
		wget $url
		dpkg -i $fname
	fi
}

install $link1
install $link2
install $link3

# setup docker registry mirror
cat > '/etc/docker/daemon.json' << EOF
{
	"registry-mirrors": ["$REGISTRY"]
}
EOF
systemctl reload docker
