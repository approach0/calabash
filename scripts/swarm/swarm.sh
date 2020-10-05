#!/bin/bash
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh
source $(dirname ${BASH_SOURCE[0]})/../random/random.sh

swarm_install() {
	SSH_ADDR=$1
	SSH_PORT=$2
	HOST_CFG=$3
	REGISTRY=$4
	$SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- < $scripts/iaas/install.$HOST_CFG.sh $REGISTRY
}

swarm_node_is_in() {
	state=$($DOCKER info -f '{{(.Swarm.LocalNodeState)}}')
	[ "$state" == "active" ] && return 0 || return 1
}

swarm_node_is_manager() {
	state=$($DOCKER info -f '{{(.Swarm.ControlAvailable)}}')
	[ "$state" == "true" ] && return 0 || return 1
}

swarm_update_secret_file() {
	SSH_ADDR=$1
	SSH_PORT=$2
	SECRET_KEY=$3
	CONFIG_FILE=$4
	tmpfile=`mktemp`
	randver=`rname_uuid`
	$SCP -P $SSH_PORT $CONFIG_FILE $SSH_ADDR:$tmpfile
	$SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- <<- EOF
		$DOCKER config rm $SECRET_KEY.latest
		echo $randver | $DOCKER config create $SECRET_KEY.latest -
		$DOCKER secret create $SECRET_KEY.$randver $tmpfile
		rm -f $tmpfile
	EOF
}

swarm_config_get() {
	SSH_ADDR=$1
	SSH_PORT=$2
	CONFIG_KEY=$3
	$SSH -p $SSH_PORT $SSH_ADDR \
		"$DOCKER config inspect --format='{{(json .Spec.Data)}}' $CONFIG_KEY | cut -d'\"' -f2 | base64 -d -"
}

swarm_node_label() {
	SSH_ADDR=$1
	SSH_PORT=$2
	LABELS="$3"
	$SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- <<- EOF
		swarmNodeID=\$($DOCKER info -f "{{.Swarm.NodeID}}")
		[ -n "$LABELS" ] && $DOCKER node update \$swarmNodeID --label-add '$LABELS'
		$DOCKER node inspect \$swarmNodeID -f "{{(json .Spec.Labels)}}"
	EOF
}

swarm_service_deploy() {
	managerIP=$1
	managerPort=$2
	service_name=$3
	# extra arguments are service_<name>_<arg> from environment variables
	extra_args='
		num_instance mesh_replicas mesh_sharding constraints
		docker_image configs mounts docker_exec portmap network
	'

	service_id=${service_name}-`rname_short`
	echo "[Deploy service] $service_id"

	# extract extra arguments from environment variables
	for argvar in $(eval echo \${!service_${service_name}_@}); do
		shortname=`echo $argvar | grep -o -P "(?<=service_${service_name}_).+"`
		eval "$shortname='${!argvar}'"
	done
	constraints=$(eval echo $(for c in ${!constraints_@}; do echo -n "--constraint=\$$c "; done))
	mounts=$(eval echo $(for m in ${!mounts_@}; do echo -n "--mount=type=bind,\$$m "; done))

	# for config files, there is a little work here...
	configs=''
	for config in ${!configs_@}; do
		key=`echo ${!config} | cut -d ':' -f 1`
		val=`echo ${!config} | cut -d ':' -f 2`
		ver=`swarm_config_get root@$managerIP $managerPort ${key}.latest`
		configs="$configs --secret src=${key}.${ver},target=$val"
	done

	# print what we got so far
	for shortname in $extra_args; do
		echo "deploy parameter [$shortname]: ${!shortname}"
	done

	# deploy service with sharding and replicas
	for shard in `seq 1 $mesh_sharding`; do
		echo "creating service ${service_id} for shard#${shard} ..."
		if [ $shard -eq 1 ]; then
			role_args="--publish=${portmap}"
		else
			role_args=""
		fi
		set -x
		$SSH -p $managerPort root@$managerIP \
			$DOCKER service create \
				--name ${service_id}-shard${shard} \
				--network=${network} \
				--hostname='{{.Service.Name}}-{{.Task.Slot}}' \
				--replicas $mesh_replicas \
				$configs \
				$constraints \
				--constraint=node.labels.shard==${shard} \
				$mounts \
				$role_args \
				${docker_image} "${docker_exec}"
		set +x
	done
}
