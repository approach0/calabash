#!/bin/bash
UCLOUD_CLI_PUBKEY=$1
UCLOUD_CLI_PRIKEY=$2

source $(dirname ${BASH_SOURCE[0]})/../common.env.sh

UCLOUD_CLI_IMG=${DOCKER_MIRROR}ga6840/ucloud-cli:latest
UCLOUD_CLI="$DOCKER run -it $UCLOUD_CLI_IMG /root/wrap-run.sh $UCLOUD_CLI_PUBKEY $UCLOUD_CLI_PRIKEY"

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
  for region in `ucloud_existing_regions`; do
    ucloud_node_list_region $region
  done
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
  SPECS=$4   # 1cpu-1gb-1mb
  IMAGE="$5"  # 'Debian 9'

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
  for region in `ucloud_existing_regions`; do
    $UCLOUD_CLI --json uhost list --uhost-id $nodeID --region=$region | python -c "if True:
    import json, sys
    j = json.load(sys.stdin)
    print(j[0]['PublicIP'])
    "
  done
}

ucloud_node_set_label() {
  $UCLOUD_CLI api --Action ModifyUHostInstanceRemark --Region cn-gd --UHostId uhost-2nbwal51 --Remark 'dog=0,cat=1,name=Kitty'
}
