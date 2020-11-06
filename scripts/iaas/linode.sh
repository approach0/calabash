#!/bin/bash
LINODE_CLI_IMG=$1
LINODE_TOKEN=$2
DOCKER_REGISTRY=$3
DOCKER_USERNAME=$4
DOCKER_PASSWORD=$5

source $(dirname ${BASH_SOURCE[0]})/../common.env.sh

LINODE_CLI="$DOCKER run $LINODE_CLI_IMG /root/wrap-run.sh $LINODE_TOKEN --suppress-warnings"

# login
if [ -n "$DOCKER_REGISTRY" ]; then
	key=$(basename $DOCKER_REGISTRY)
	if ! grep $key ~/.docker/config.json; then
		$DOCKER login $DOCKER_REGISTRY -u $DOCKER_USERNAME -p $DOCKER_PASSWORD
	fi
fi

linode_node_list() {
	$LINODE_CLI linodes list
}

linode_node_list_in_json() {
	$LINODE_CLI --json linodes list
}

linode_node_list_labels() {
	linode_node_list_in_json | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	a = map(lambda x: x['label'], j)
	a = list(set(a))
	print(' '.join(a))
	"
}

linode_node_filter_by_label() {
	prefix=$1
	if [ "$prefix" == '' ]; then
		return
	fi;

  set -x
	linode_node_list_in_json | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	a = filter(lambda x: x['label'].startswith('${prefix}'), j)
	a = map(lambda x: str(x['id']), a)
	print(' '.join(a))
	"
  set +x
}

linode_node_create() {
	PASSWD=$1
	LABEL=$2	# calabash-usrname-3-m
	REGION=$3 # ap-southeast, us-west
	SPECS=$4	# g6-nanode-1
	IMAGE=$5	# linode/debian10

	$LINODE_CLI linodes create \
		--root_pass=$1 \
		--label=$LABEL \
		--region=$REGION \
		--type=$SPECS \
		--image=$IMAGE \
		--booted=true \
		--private_ip=false

	echo 'Just created, testing status ...'

	nodeID=$(linode_node_filter_by_label $LABEL)
	while true; do
		$LINODE_CLI --json linodes view $nodeID | python -c "if True:
		import json, sys
		j = json.load(sys.stdin)
		status = j[0]['status']
		print(status)
		quit('running' == status)
		"
		if [ $? -eq 1 ]; then
			break
		else
			sleep 10
		fi
	done
}

linode_node_delete() {
	nodeID=$1
	$LINODE_CLI linodes delete $nodeID
}

linode_node_map_ipaddr() {
	nodeID=$1
	$LINODE_CLI --json linodes view $nodeID | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	print(j[0]['ipv4'][0])
	"
}

linode_regions() {
	$LINODE_CLI regions list
}

linode_list_node_types() {
  # to see what specs available
	$LINODE_CLI linodes types
}

linode_account_balance() {
	$LINODE_CLI --json account view
}
