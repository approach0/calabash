#!/bin/bash
LINODE_TOKEN=$1

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh

LINODE_CLI_IMG=${DOCKER_MIRROR}ga6840/linode-cli:latest
LINODE_CLI="$DOCKER run $LINODE_CLI_IMG /root/wrap-run.sh $LINODE_TOKEN --suppress-warnings"

linode_regions() {
  $LINODE_CLI regions list
}

linode_node_list() {
  FLAGS=$1
  $LINODE_CLI $FLAGS linodes list
}

linode_node_list_labels() {
  linode_node_list --json | python -c "if True:
  import json, sys
  j = json.load(sys.stdin)
  a = map(lambda x: x['label'], j)
  a = list(set(a))
  print(' '.join(a))
  "
}

linode_node_create() {
  PASSWD=$1
  LABEL=$2  # calabash-swarm3-master
  REGION=$3 # ap-southeast, us-west
  SPECS=$4  # g6-nanode-1
  IMAGE=$5  # linode/debian10

  $LINODE_CLI linodes create \
    --root_pass=$1 \
    --label=$LABEL \
    --region=$REGION \
    --type=$SPECS \
    --image=$IMAGE \
    --booted=true \
    --private_ip=false
}

linode_node_delete() {
  nodeID=$1
  $LINODE_CLI linodes delete $nodeID
}

linode_node_filter_by_label() {
  prefix=$1
  if [ "$prefix" == '' ]; then
    return
  fi;

  linode_node_list --json | python -c "if True:
  import json, sys
  j = json.load(sys.stdin)
  a = filter(lambda x: x['label'].startswith('${prefix}'), j)
  a = map(lambda x: str(x['id']), a)
  print(' '.join(a))
  "
}

linode_list_node_types() {
  $LINODE_CLI linodes types
}

linode_account_balance() {
  $LINODE_CLI --json account view
}
