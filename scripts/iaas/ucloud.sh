#!/bin/bash
UCLOUD_CLI_PUBKEY=$1
UCLOUD_CLI_PRIKEY=$2

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh

UCLOUD_CLI_IMG=${DOCKER_MIRROR}ga6840/ucloud-cli:latest
UCLOUD_CLI="$DOCKER run $UCLOUD_CLI_IMG /root/wrap-run.sh $UCLOUD_CLI_PUBKEY $UCLOUD_CLI_PRIKEY"

ucloud_list_nodes() {
  $UCLOUD_CLI uhost list
}
