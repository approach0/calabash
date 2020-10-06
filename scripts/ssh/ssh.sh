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
