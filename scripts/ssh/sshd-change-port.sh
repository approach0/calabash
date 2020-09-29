#!/bin/sh
SSH_ADDR=$1
OLD_PORT=$2
NEW_PORT=$3

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh

$SSH $SSH_ADDR -p $OLD_PORT << EOF
cat /etc/ssh/sshd_config
echo "changing port from $OLD_PORT to $NEW_PORT ..."
sed -i '/Port ${OLD_PORT}/c Port ${NEW_PORT}' /etc/ssh/sshd_config
systemctl restart sshd
EOF
