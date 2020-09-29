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
  PORT=$7

  label=calabash-${USR}-${SWARM}-${FLAG}-$(rname_short)
  echo 'creating node ...'
  ${IaaS}_node_create $PASSWD $label $CONFIG

  echo 'getting nodeID ...'
  nodeID=`${IaaS}_node_filter_by_label $label`

  echo 'getting node IP ...'
  IP=`${IaaS}_node_map_ipaddr $nodeID`

  echo 'updating ~/.ssh/known_hosts ...'
  ssh-keygen -R $IP

  fail=0
  while true; do
    echo 'copying pubkey ...'
    $SSH_SCRIPTS/ssh-copy-id.expect root@$IP $PASSWD
    if [ $? -ne 0 ]; then
      let 'fail = fail + 1'
      if [ $fail -ge 3 ]; then
        echo "failed $fail time(s), abort ..."
        return 1
      else
        echo "failed $fail time(s), retry ..."
      fi
    else
      break
    fi
  done

  echo 'change sshd port ...'
  OLDPORT=22
  $SSH_SCRIPTS/sshd-change-port.sh root@$IP $OLDPORT $PORT

  echo 'install docker ...'
  $SSH -p $PORT root@$IP "
    apt-get update

    which docker || curl -fsSL https://get.docker.com -o get-docker.sh
    which docker || sh get-docker.sh

    # get mosh in case of login in slow connection
    apt-get install -y -qq --no-install-recommends mosh
    echo '=== mosh login ==='
    echo mosh --ssh=\"'ssh -p ${PORT}'\" root@${IP}
  "
}
