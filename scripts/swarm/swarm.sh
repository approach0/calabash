#!/bin/bash
source $(dirname ${BASH_SOURCE[0]})/../common.env.sh
source $(dirname ${BASH_SOURCE[0]})/../random/random.sh

swarm_install() {
	SSH_ADDR=$1
	SSH_PORT=$2
	HOST_CFG=$3
	REGISTRY=$4
	hostname=$5
	posthook=${@:6}
	$SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- < \
		$scripts/iaas/install.$HOST_CFG.sh $REGISTRY $hostname

	for hook in $posthook; do
		hook_func=${!hook}
		echo "[hook install] $hook_func"
		#$SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- < \
			$scripts/iaas/hooks.$HOST_CFG.sh $hook_func
	done
}

is_in_swarm() {
	state=$($DOCKER info -f '{{(.Swarm.LocalNodeState)}}')
	[ "$state" == "active" ] && return 0 || return 1
}

is_swarm_manager() {
	state=$($DOCKER info -f '{{(.Swarm.ControlAvailable)}}')
	[ "$state" == "true" ] && return 0 || return 1
}

swarm_print_nodes() {
	$DOCKER node ls -q | xargs $DOCKER node inspect \
		--format '{{.Description.Hostname}}  {{json .CreatedAt}}  {{.Status.Addr}} [{{.Status.State}}] {{json .Spec}}'
}

swarm_print_services() {
	$DOCKER node ls -q | xargs $DOCKER node ps --filter 'desired-state=running' \
		--format '{{.Node}}  {{.Name}}  {{.Image}}  ({{.CurrentState}} {{.Error}})'
}

swarm_print_service_overview() {
	service_name=$1
	$DOCKER service ls --filter="name=${service_name}"
}

swarm_print_service_logs() {
	service_name=$1
	$DOCKER service logs ${service_name} --raw --tail 200 --timestamps
}

swarm_print_service_image() {
	service_name=$1
	$DOCKER service inspect ${service_name} -f '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
}

swarm_update_secret_file() {
	SECRET_KEY=$1
	CONFIG_FILE=$2

	uuid=`random_uuid`
	$DOCKER config rm $SECRET_KEY.latest
	echo $uuid | $DOCKER config create $SECRET_KEY.latest -
	$DOCKER secret create ${SECRET_KEY}.${uuid} $CONFIG_FILE
}

swarm_config_get() {
	CONFIG_KEY=$1
	$DOCKER config inspect --format='{{(json .Spec.Data)}}' $CONFIG_KEY | cut -d'"' -f2 | base64 -d -
}

swarm_node_id() {
	$DOCKER info -f "{{.Swarm.NodeID}}"
}

swarm_node_label() {
	swarmNodeID=$1
	LABELS="$2"
	[ -n "$LABELS" ] && $DOCKER node update $swarmNodeID --label-add "$LABELS"
	$DOCKER node inspect $swarmNodeID -f "{{(json .Spec.Labels)}}"
}

swarm_network_ensure_has() {
	NAME=$1
	DRIVER=$2
	networkID=$($DOCKER network ls -q --filter "name=$NAME")
	if [ -z "$networkID" ]; then
		echo "creating network $NAME ($DRIVER) ..."
		$DOCKER network create -d $DRIVER $NAME
	else
		echo "already exists: network $NAME ($DRIVER) ..."
	fi
}

swarm_service_update_configs() {
	servName=$1

	config_bind=''
	for varname in $(eval echo \${!service_${servName}_config_bind_@}); do
		typ=`echo ${!varname} | cut -d ':' -f 1` # type
		key=`echo ${!varname} | cut -d ':' -f 2` # key
		dst=`echo ${!varname} | cut -d ':' -f 3` # destination

		# get config sources
		cfgsrc=`echo "$varname" | sed -e 's/_bind_/_source_/'`
		src="${!cfgsrc}"
		oneline_src=$(echo -n "$src" | sed -e '/./,$!d' | tr -s ' ' | tr '\n' '; ')

		# update config files
		if [ "$typ" == "text" ]; then
			tmpfile=`mktemp`
			cat > $tmpfile <<< "$src"
			swarm_update_secret_file $key $tmpfile &> /dev/null
			rm -f $tmpfile

		elif [ "$typ" == "path" ]; then
			srcpath=$(eval echo $src)
			swarm_update_secret_file $key $srcpath &> /dev/null

		else
			continue
		fi

		# output the secret argument string
		ver=`swarm_config_get ${key}.latest`
		config_bind="--secret src=${key}.${ver},target=$dst $config_bind"
	done

	echo "$config_bind"
}

swarm_service_create() {
	servName=$1
	servUseName=${2-$servName}
	max_restart=${service_max_restart-3}

	# extract extra arguments from environment variables
	for argvar in $(eval echo \${!service_${servName}_@}); do
		shortname=`echo $argvar | grep -o -P "(?<=service_${servName}_).+"`
		assignment="$shortname='${!argvar}'"
		eval "$assignment"
	done

	# set default value if any argument is not specified
	mesh_replicas=${mesh_replicas-1}
	mesh_sharding=${mesh_sharding-1}
	max_per_node=${max_per_node-0}
	restart_condition=${restart_condition-any}

	# get "list" variables
	constraints=$(eval echo $(for c in ${!constraints_@}; do echo -n "--constraint=\$$c "; done))
	mounts=$(eval echo $(for m in ${!mounts_@}; do echo -n "--mount=\$$m "; done))
	configs=`swarm_service_update_configs $servUseName`

	# print service arguments
	for argvar in ${!service_print_arguments_@}; do
		shortname="${!argvar}"
		echo "[argument '$shortname'] ${!shortname}"
	done

	# creating service with sharding...
	for shard in `seq 1 $mesh_sharding`; do
		echo "CREATE SERVICE $servUseName (shard#${shard}/$mesh_sharding)"

		if [ $shard -gt 1 ]; then
			servID="${servUseName}-shard${shard}"
		else
			servID="${servUseName}"
		fi

		extra_args="--name ${servID}"
		if [[ $shard -eq 1 || "${portmap}" =~ 'mode=host' ]]; then
			if [ -n "$portmap" ]; then
				extra_args="${extra_args} --publish=${portmap}"
			fi
		fi

		if [ -n "$network" ]; then
			read driver <<< $(unpack \$network_${network}_driver)
			swarm_network_ensure_has $network $driver
			extra_args="${extra_args} --network=${network}"
		fi

		set -x
		$DOCKER service create \
			--hostname='{{.Service.Name}}-{{.Task.Slot}}' \
			--replicas=$mesh_replicas \
			--replicas-max-per-node=$max_per_node \
			--restart-condition=$restart_condition \
			--restart-max-attempts=$max_restart \
			--constraint=node.labels.shard==${shard} \
			$constraints \
			$configs \
			$mounts \
			$extra_args \
			--with-registry-auth \
			--entrypoint "''" \
			${docker_image} $(eval echo "$docker_exec")
		set +x
	done
}

swarm_service_update() {
	servName=$1
	servUseName=${2-$servName}
	tag=${3-latest}
	configs=`swarm_service_update_configs $servUseName`

	read docker_image <<< $(unpack \$service_${servName}_docker_image)
	set -x
	$DOCKER service update \
		--force \
		--update-order=start-first \
		--with-registry-auth \
		--image ${docker_image}:${tag} \
		$servUseName
	set +x
}
