#!/bin/sh
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh

sshd_change_port() {
	SSH_ADDR=$1
	OLD_PORT=$2
	NEW_PORT=$3
	$SSH -p $OLD_PORT $SSH_ADDR <<- EOF
		sed -i '/Port ${OLD_PORT}/c Port ${NEW_PORT}' /etc/ssh/sshd_config
		systemctl restart sshd
	EOF
}

sshd_allow_self_login() {
	IP=$1
	PORT=$2
	$SSH -p $PORT root@$IP <<- EOF
		ssh-keygen -f ~/.ssh/id_rsa -t rsa -N "''"
		cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
		chmod og-wx ~/.ssh/authorized_keys
	EOF
}
