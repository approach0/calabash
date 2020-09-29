#!/bin/bash

# You need to source $SCRIPT_PATH/../iaas/* with credential tokens
# before running this script.

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh
SSH_SCRIPTS=$SCRIPT_PATH/../ssh

swarm_allocate() {
  IaaS=$1 # linode
  USR=$2  # calabash user name
  SWARM=$3 # 1, 2 ...
  [ $4 == 'manager' ] && FLAG='m' || FLAG='w'
  PASSWD=$5
  CONFIG=$(echo $6 | sed 's/,/ /g') # ap-southeast,g6-nanode-1,linode/debian10

  label=calabash-${USR}-${SWARM}-${FLAG}-$(rname_short)
  echo 'creating node ...'
  ${IaaS}_node_create $PASSWD $label $CONFIG

  echo 'getting nodeID ...'
  nodeID=`${IaaS}_node_filter_by_label $label`

  echo 'getting node IP ...'
  IP=`${IaaS}_node_map_ipaddr $nodeID`

  return $IP
}

swarm_install()
{
  IP=$1
  PASSWD=$2
  PORT=$3
  OLDPORT=22

  $SSH_SCRIPTS/ssh-copy-id.expect root@$IP $PASSWD
  $SSH_SCRIPTS/sshd-change-port.sh root@$IP $OLDPORT $PORT

  $SSH -p $PORT root@$IP "
    apt-get update

    which docker || curl -fsSL https://get.docker.com -o get-docker.sh
    which docker || sh get-docker.sh

    # get mosh in case of login in slow connection
    apt-get install -y mosh
    echo '=== mosh login ==='
    echo mosh --ssh=\"'ssh -p ${PORT}'\" root@${IP}
  "
}
