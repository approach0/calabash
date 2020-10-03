#!/bin/bash
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh
source $(dirname ${BASH_SOURCE[0]})/../random/random.sh

swarm_install() {
  SSH_ADDR=$1
  SSH_PORT=$2
  HOST_CFG=$3
  $SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- < $scripts/swarm/install.$HOST_CFG.sh
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
  $SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- <<- EOF
    $DOCKER config rm $SECRET_KEY.latest
    echo $randver | $DOCKER config create $SECRET_KEY.latest -
    $DOCKER secret create $SECRET_KEY.$randver $tmpfile
    rm -f $tmpfile
	EOF
}

swarm_config_get() {
  SSH_ADDR=$1
  SSH_PORT=$2
  CONFIG_KEY=$3
  $SSH -p $SSH_PORT $SSH_ADDR \
    "$DOCKER config inspect --format='{{(json .Spec.Data)}}' $CONFIG_KEY | cut -d'\"' -f2 | base64 -d -"
}

swarm_node_label() {
  SSH_ADDR=$1
  SSH_PORT=$2
  LABELS="$3"
  $SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- <<- EOF
    swarmNodeID=\$($DOCKER info -f "{{.Swarm.NodeID}}")
    [ -n "$LABELS" ] && $DOCKER node update \$swarmNodeID --label-add '$LABELS'
    $DOCKER node inspect \$swarmNodeID -f "{{(json .Spec.Labels)}}"
	EOF
}
