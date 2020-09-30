#!/bin/bash
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh

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

swarm_db_set() {
  KEY=$1
  VAL="$2"
  echo "$VAL" | $DOCKER config create $KEY -
}

swarm_db_get() {
  KEY=$1
  $DOCKER config inspect --format='{{(json .Spec.Data)}}' $KEY | cut -d'\"' -f2 | base64 -d -
}

swarm_node_is_in() {
  state=$($DOCKER info -f '{{(.Swarm.LocalNodeState)}}')
  [ "$state" == "active" ] && return 0 || return 1
}

swarm_node_is_manager() {
  state=$($DOCKER info -f '{{(.Swarm.ControlAvailable)}}')
  [ "$state" == "true" ] && return 0 || return 1
}
