#!/bin/bash
UCLOUD_CLI_PUBKEY=$1
UCLOUD_CLI_PRIKEY=$2

SCRIPT_PATH="$(dirname ${BASH_SOURCE[0]})"
source $SCRIPT_PATH/../common.env.sh

UCLOUD_CLI_IMG=${DOCKER_MIRROR}ga6840/ucloud-cli:latest
UCLOUD_CLI="$DOCKER run -it $UCLOUD_CLI_IMG /root/wrap-run.sh $UCLOUD_CLI_PUBKEY $UCLOUD_CLI_PRIKEY"

ucloud_node_list() {
  $UCLOUD_CLI --json uhost list --region cn-gd
}

ucloud_regions() {
  $UCLOUD_CLI region
}

ucloud_node_create() {
  PASSWD=$1
  $UCLOUD_CLI uhost create --cpu 1 --memory-gb 1 --password $PASSWD --image-id uimage-j0r4vh --region cn-gd --zone cn-gd-02 --charge-type 'Dynamic' --firewall-id firewall-njshvwlr --vpc-id uvnet-touf2ybp --subnet-id subnet-b2ksux2q --create-eip-bandwidth-mb 1 --name 'calabash_node'
}

ucloud_node_delete() {
  HOSTID=$1
  $UCLOUD_CLI uhost delete --region cn-gd --yes --uhost-id $HOSTID
}

ucloud_account_balance() {
  $UCLOUD_CLI api --Action DescribeAccountSummary
}

ucloud_node_set_label() {
  $UCLOUD_CLI api --Action ModifyUHostInstanceRemark --Region cn-gd --UHostId uhost-2nbwal51 --Remark 'dog=0,cat=1,name=Kitty'
}
