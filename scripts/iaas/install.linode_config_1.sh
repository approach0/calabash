#!/bin/sh
REGISTRY=$1
hostname=$2

# install docker
apt-get update
which docker || curl -fsSL https://get.docker.com -o get-docker.sh
which docker || sh get-docker.sh

# setup docker registry mirror
cat > '/etc/docker/daemon.json' << EOF
{
	"registry-mirrors": ["$REGISTRY"]
}
EOF
systemctl reload docker

# get mosh in case of login in slow connection
apt-get install -y -qq --no-install-recommends mosh
echo Mosh Usage: mosh --ssh="'ssh -p 8921'" SSH_ADDR

# change hostname
echo "$hostname" > /etc/hostname
hostname -F /etc/hostname

# install other utility commands
apt-get install -y -qq --no-install-recommends atop smem
# smem usage: smem -pkw
