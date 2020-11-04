#!/bin/sh
REGISTRY=$1
hostname=$2

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

# setup docker registry mirror and Prometheus interface
# (See https://docs.docker.com/config/daemon/prometheus)
cat > '/etc/docker/daemon.json' << EOF
{
	"registry-mirrors": ["$REGISTRY"],

	"metrics-addr" : "127.0.0.1:9323",
	"experimental" : true
}
EOF
systemctl restart docker
# Now you can do `curl localhost:9323/metrics`

# change hostname
echo "$hostname" > /etc/hostname
hostname -F /etc/hostname

# install prometheus node exporter (listening at localhost:9100/metrics)
apt-get install -y -qq --no-install-recommends prometheus-node-exporter

# install other utility commands
apt-get install -y -qq --no-install-recommends atop smem
# smem usage: smem -pkw
