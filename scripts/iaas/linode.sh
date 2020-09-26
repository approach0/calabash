#!/bin/bash
SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
LINODE_TOKEN=$1

source $SCRIPT_PATH/../common.env.sh

LINODE_CLI="$DOCKER run linode-cli /root/wrap-run.sh $LINODE_TOKEN --suppress-warnings"

list_nodes() {
  $LINODE_CLI linodes list
}
