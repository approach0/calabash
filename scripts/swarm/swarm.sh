#!/bin/bash
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh
source $(dirname ${BASH_SOURCE[0]})/../random/random.sh

swarm_install() {
  SSH_ADDR=$1
  SSH_PORT=$2
  $SSH -p $SSH_PORT $SSH_ADDR "
    apt-get update

    which docker || curl -fsSL https://get.docker.com -o get-docker.sh
    which docker || sh get-docker.sh

    # get mosh in case of login in slow connection
    apt-get install -y -qq --no-install-recommends mosh
    echo '=== mosh login ==='
    echo mosh --ssh=\"'ssh -p ${SSH_PORT}'\" ${SSH_ADDR}
  "
}

swarm_node_is_in() {
  state=$($DOCKER info -f '{{(.Swarm.LocalNodeState)}}')
  [ "$state" == "active" ] && return 0 || return 1
}

swarm_node_is_manager() {
  state=$($DOCKER info -f '{{(.Swarm.ControlAvailable)}}')
  [ "$state" == "true" ] && return 0 || return 1
}

swarm_update_secret_file() {
  SSH_ADDR=$1
  SSH_PORT=$2
  SECRET_KEY=$3
  CONFIG_FILE=$4
  tmpfile=`mktemp`
  randver=`rname_uuid`
  $SCP -P $SSH_PORT $CONFIG_FILE $SSH_ADDR:$tmpfile
  $SSH -p $SSH_PORT $SSH_ADDR "$DOCKER config rm $SECRET_KEY.latest"
  $SSH -p $SSH_PORT $SSH_ADDR "echo $randver | $DOCKER config create $SECRET_KEY.latest -"
  $SSH -p $SSH_PORT $SSH_ADDR "$DOCKER secret create $SECRET_KEY.$randver $tmpfile"
  $SSH -p $SSH_PORT $SSH_ADDR "rm -f $tmpfile"
}

swarm_config_get() {
  SSH_ADDR=$1
  SSH_PORT=$2
  CONFIG_KEY=$3
  $SSH -p $SSH_PORT $SSH_ADDR \
    "$DOCKER config inspect --format='{{(json .Spec.Data)}}' $CONFIG_KEY | cut -d'\"' -f2 | base64 -d -"
}
