#!/bin/sh
DOCKER_MIRROR=$1
hostname=$2

# install docker
apt-get update
which docker || curl -fsSL https://get.docker.com -o get-docker.sh
which docker || sh get-docker.sh

# setup docker registry mirror and Prometheus interface
# (See https://docs.docker.com/config/daemon/prometheus)
cat > '/etc/docker/daemon.json' << EOF
{
	"registry-mirrors": ["$DOCKER_MIRROR"],

	"log-driver": "json-file",
	"log-opts": {
		"max-size": "10m",
		"max-file": "3"
	},

	"metrics-addr" : "0.0.0.0:9323",
	"experimental" : true
}
EOF
systemctl restart docker
# Now you can do `curl 127.0.0.1:9323/metrics`

# get mosh in case of login in slow connection
apt-get install -y -qq --no-install-recommends mosh
echo Mosh Usage: mosh --ssh="'ssh -p 8921'" SSH_ADDR

# change hostname
echo "$hostname" > /etc/hostname
hostname -F /etc/hostname

# install prometheus node exporter (listening at localhost:9100/metrics)
apt-get install -y -qq --no-install-recommends prometheus-node-exporter

# install other utility commands
apt-get install -y -qq --no-install-recommends atop smem ncdu
# smem usage: smem -pkw

# add CRON jobs for regularly memory/disk cleanup
(crontab -l ; echo '50 1 * * * docker system prune --force') | sort - | uniq - | crontab -
(crontab -l ; echo '60 1 * * * docker image prune -a --force') | sort - | uniq - | crontab -

#(crontab -l ; echo '30 1 * * * sync; echo 1 > /proc/sys/vm/drop_caches') | sort - | uniq - | crontab -
#(crontab -l ; echo '40 1 * * * swapoff -a; swapon -a') | sort - | uniq - | crontab -

crontab -l
# tail -1000 /var/log/syslog | grep CRON
