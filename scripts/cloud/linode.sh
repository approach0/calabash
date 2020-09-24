#!/bin/bash
source ../common.env.sh
LINODE_CLI= $DOCKER run linode-cli /root/wrap-run.sh $LINODE_TOKEN --suppress-warnings

list_nodes() {
	$LINODE_CLI linodes list
}

export -f list_nodes
