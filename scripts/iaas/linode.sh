#!/bin/bash
LINODE_TOKEN=$1

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh

LINODE_CLI_IMG=${DOCKER_MIRROR}ga6840/linode-cli:latest
LINODE_CLI="$DOCKER run $LINODE_CLI_IMG /root/wrap-run.sh $LINODE_TOKEN --suppress-warnings"

linode_list_nodes() {
  $LINODE_CLI linodes list
}

linode_list_node_types() {
  $LINODE_CLI linodes types
}
