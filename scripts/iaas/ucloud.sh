#!/bin/bash
UCLOUD_CLI_IMG=$1
UCLOUD_CLI_PUBKEY=$2
UCLOUD_CLI_PRIKEY=$3
DOCKER_REGISTRY=$4
UHUB_USERNAME=$5
UHUB_PASSWORD=$6

source $(dirname ${BASH_SOURCE[0]})/../common.env.sh

UCLOUD_CLI="$DOCKER run -it $UCLOUD_CLI_IMG /root/wrap-run.sh $UCLOUD_CLI_PUBKEY $UCLOUD_CLI_PRIKEY"

# login
if [ -n "$DOCKER_REGISTRY" ]; then
	key=$(basename $DOCKER_REGISTRY)
	if ! grep $key ~/.docker/config.json; then
		$DOCKER login $DOCKER_REGISTRY -u $UHUB_USERNAME -p $UHUB_PASSWORD
	fi
fi

ucloud_existing_regions() {
	$UCLOUD_CLI api --Action GetProjectResourceCount --ProductType uhost | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	a = filter(lambda x: x['ProductType'].startswith('uhost'), j['Infos'])
	a = list(a)
	if len(a) > 0:
		a = a[0]['RegionInfos']
		a = map(lambda x: x['Region'], a)
		print(' '.join(a))
	"
}

ucloud_regions() {
	$UCLOUD_CLI region
}

ucloud_node_list_region() {
	REGION=$1
	FLAGS=$2
	$UCLOUD_CLI $FLAGS uhost list --region=$REGION
}

ucloud_node_list() {
	regions=`ucloud_existing_regions`
	for region in $regions; do
		ucloud_node_list_region $region
	done
	if [ -z $regions ]; then
		echo "no ucloud node."
	fi
}

ucloud_node_list_in_json() {
	regions=`ucloud_existing_regions`
	acc_file=`mktemp`
	echo '[]' > $acc_file
	for region in $regions; do
		tmp_file=`mktemp`
		out_file=`mktemp`
		ucloud_node_list_region $region --json 2>/dev/null >$tmp_file
		jq -s '.[0] + .[1]' $acc_file $tmp_file > $out_file
		mv $out_file $acc_file
	done
	cat $acc_file
}

ucloud_node_list_labels() {
	labels=""
	for region in `ucloud_existing_regions`; do
		labels="$labels `ucloud_node_list_region $region --json | python -c "if True:
		import json, sys
		j = json.load(sys.stdin)
		a = map(lambda x: x['UHostName'], j)
		a = list(set(a))
		print(' '.join(a))
		"`"
	done
	echo "$labels" | python -c "if True:
	import json, sys
	r = sys.stdin.read()
	a = r.split()
	a = list(set(a))
	print(' '.join(a))
	"
}

ucloud_node_create() {
	PASSWD=$1
	LABEL=$2  # calabash-usrname-3-m
	REGION=$3 # cn-gd, cn-bj2, tw-tp, hk
	SPECS=$4  # 1cpu-1gb-1mb
	IMAGE="$(echo $5 | sed -e 's/_/ /g')" # 'Debian_9'

	image_id=`$UCLOUD_CLI --json image list --region $REGION | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	a = filter(lambda x: x['ImageName'].startswith('${IMAGE}'), j)
	print(list(a)[0]['ImageID'])
	"`
	echo "use image: $image_id"

	n_cpu=$(echo $SPECS | awk -F'-' '{print $1}' | grep -o '[0-9]*')
	n_mem=$(echo $SPECS | awk -F'-' '{print $2}' | grep -o '[0-9]*')
	n_bwd=$(echo $SPECS | awk -F'-' '{print $3}' | grep -o '[0-9]*')

	zones=`$UCLOUD_CLI --json region | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	a = filter(lambda x: x['Region'] == '${REGION}', j)
	print(list(a)[0]['Zones'])
	"`
	zone=$(echo $zones | awk -F',' '{print $1}')
	echo "use zone: $zone"

	firewall=`$UCLOUD_CLI --json firewall list --region $REGION | python -c "if True:
	import json, sys
	j = json.load(sys.stdin)
	a = filter(lambda x: 'TCP|80' in x['Rule'], j)
	print(list(a)[0]['ResourceID'])
	"`
	echo "use firewall: $firewall"

	$UCLOUD_CLI uhost create \
		--password $PASSWD \
		--name $LABEL \
		--cpu $n_cpu \
		--memory-gb $n_mem \
		--image-id $image_id \
		--region $REGION \
		--zone $zone \
		--charge-type 'Dynamic' \
		--firewall-id $firewall \
		--create-eip-bandwidth-mb $n_bwd

	echo 'wait a few seconds for ucloud to establish SSH port ...'
	sleep 16
}

ucloud_node_delete() {
	HOSTID=$1
	for region in `ucloud_existing_regions`; do
		$UCLOUD_CLI uhost delete --region $region --yes --uhost-id $HOSTID
	done
}

ucloud_account_balance() {
	$UCLOUD_CLI api --Action DescribeAccountSummary
}

ucloud_node_filter_by_label() {
	prefix=$1
	IDs=""
	for region in `ucloud_existing_regions`; do
		IDs="$IDs `ucloud_node_list_region $region --json | python -c "if True:
		import json, sys
		j = json.load(sys.stdin)
		a = filter(lambda x: x['UHostName'].startswith('${prefix}'), j)
		a = map(lambda x: str(x['ResourceID']), a)
		a = list(set(a))
		print(' '.join(a))
		"`"
	done
	echo "$IDs"
}

ucloud_node_map_ipaddr() {
	nodeID=$1
	# due to Ucloud strict firewall policy, always use private IP
	typeIP='private'

	if [ "$typeIP" == "public" ]; then
		qry=PublicIP
	elif [ "$typeIP" == "private" ]; then
		qry=PrivateIP
	else
		echo "typeIP not specified."
		exit 1
	fi

	for region in `ucloud_existing_regions`; do
		$UCLOUD_CLI --json uhost list --uhost-id $nodeID --region=$region | python -c "if True:
		import json, sys
		j = json.load(sys.stdin)
		print(j[0]['${qry}'])
		"
	done
}

ucloud_node_set_label() {
	$UCLOUD_CLI api --Action ModifyUHostInstanceRemark --Region cn-gd --UHostId uhost-2nbwal51 --Remark 'dog=0,cat=1,name=Kitty'
}
