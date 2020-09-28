#!/bin/bash
UCLOUD_CLI_PUBKEY=$1
UCLOUD_CLI_PRIKEY=$2

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh

UCLOUD_CLI_IMG=${DOCKER_MIRROR}ga6840/ucloud-cli:latest
UCLOUD_CLI="$DOCKER run -it $UCLOUD_CLI_IMG /root/wrap-run.sh $UCLOUD_CLI_PUBKEY $UCLOUD_CLI_PRIKEY"

ucloud_list_nodes() {
  $UCLOUD_CLI uhost list --region cn-gd
}

ucloud_list_regions() {
  $UCLOUD_CLI region
}

ucloud_node_create() {
  PASSWD=$1
  $UCLOUD_CLI uhost create --cpu 1 --memory-gb 1 --password $PASSWD --image-id uimage-j0r4vh --region cn-gd --zone cn-gd-02 --charge-type 'Dynamic'
}

ucloud_node_delete() {
  HOSTID=$1
  $UCLOUD_CLI uhost delete --region cn-gd --yes --uhost-id $HOSTID
}
