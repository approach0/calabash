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
		$SSH -p $SSH_PORT $SSH_ADDR 'bash -s' -- < \
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
		--format '{{.ID}} {{.Description.Hostname}}  {{json .CreatedAt}}  {{.Status.Addr}} [{{.Status.State}}] {{json .Spec}}'
}

swarm_print_services() {
	$DOCKER node ls -q | while read nodeid; do
		host_name=$($DOCKER node inspect $nodeid --format '{{.Description.Hostname}}')
		echo "Node $nodeid ( $host_name ):"
		$DOCKER node ps $nodeid --format '{{.Name}}  {{.Image}}  ({{.CurrentState}} {{.Error}})' --filter 'desired-state=running'
	done
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

swarm_network_space() {
	netname="$1"
	docker network inspect $netname -f '{{(index .IPAM.Config 0).Subnet}}'
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
	local servName=$1

	local config_bind=''
	for varname in $(eval echo \${!service_${servName}_config_bind_@}); do
		local typ=`echo ${!varname} | cut -d ':' -f 1` # type
		local key=`echo ${!varname} | cut -d ':' -f 2` # key
		local dst=`echo ${!varname} | cut -d ':' -f 3` # destination

		# get config sources
		local cfgsrc=`echo "$varname" | sed -e 's/_bind_/_source_/'`
		local src="${!cfgsrc:Q}"
		local oneline_src=$(echo -n "$src" | sed -e '/./,$!d' | tr -s ' ' | tr '\n' '; ')

		# update config files
		if [ "$typ" == "text" ]; then
			local tmpfile=`mktemp`
			cat > $tmpfile <<< "$src"
			swarm_update_secret_file $key $tmpfile &> /dev/null
			echo "=== config file $key ===" >&2
			cat $tmpfile >&2 # print config file
			rm -f $tmpfile

		elif [ "$typ" == "path" ]; then
			local srcpath=$(eval echo $src)
			swarm_update_secret_file $key $srcpath &> /dev/null
			echo "=== config file $key from $srcpath ===" >&2
			cat $srcpath >&2 # print config file

		else
			continue
		fi

		# output the secret argument string
		local ver=`swarm_config_get ${key}.latest`
		local config_bind="--secret src=${key}.${ver},target=$dst $config_bind"
	done

	echo "$config_bind"
}

swarm_service_create() {
	local servName=$1
	local useImage=$2

	# extract extra arguments from environment variables
	for argvar in $(eval echo \${!service_${servName}_@}); do
		local shortname=`echo $argvar | grep -o -P "(?<=service_${servName}_).+"`
		eval local $shortname="${!argvar:Q}"
	done

	# set default value if any argument is not specified
	local mesh_replicas=${mesh_replicas-1}
	local mesh_sharding=${mesh_sharding-1}
	local max_per_node=${max_per_node-0}
	local restart_condition=${restart_condition-any}
	local stop_signal=${stop_signal-SIGINT}

	# get complex variables
	local service_labels=$(eval echo $(for l in ${!labels_@}; do echo -n "--label=\$$l "; done))
	local constraints=$(eval echo $(for c in ${!constraints_@}; do echo -n "--constraint=\$$c "; done))
	local mounts=$(eval echo $(for m in ${!mounts_@}; do echo -n "--mount=\$$m "; done))
	local environments=$(eval echo $(for e in ${!env_@}; do echo -n "--env=\$$e "; done))
	echo '[[[ swarm_service_update_configs ]]]'
	local configs=`swarm_service_update_configs $servName`

	# print service arguments
	for argvar in ${!service_print_arguments_@}; do
		local shortname="${!argvar}"
		echo "[argument '$shortname'] ${!shortname}"
	done

	# creating service with sharding...
	for shard in `seq 1 $mesh_sharding`; do
		echo "CREATE SERVICE $servName (shard#${shard}/$mesh_sharding)"

		if [ $shard -gt 1 ]; then
			local servID="${servName}-shard${shard}"
		else
			local servID="${servName}"
		fi

		# parse docker_exec to handle both variables and pipes (with some stupid hacks)
		local entrypoint_overwrite=""
		local execute_line=$(eval echo $(echo $docker_exec | sed -e 's/|/__PIPE__/g') | sed -e 's/__PIPE__/|/g')
		if [ -n "$execute_line" ]; then
			# ensure we overwrite default entrypoint
			entrypoint_overwrite="--entrypoint ''"
		fi

		local extra_args="--name ${servID}"
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
		$DOCKER service rm ${servID}
		$DOCKER service create \
			--hostname='{{.Service.Name}}-{{.Task.Slot}}' \
			--replicas=$mesh_replicas \
			--replicas-max-per-node=$max_per_node \
			--restart-condition=$restart_condition \
			--constraint=node.labels.shard==${shard} \
			--stop-signal=$stop_signal \
			$service_labels \
			$constraints \
			$environments \
			$configs \
			$mounts \
			$extra_args \
			--with-registry-auth \
			$entrypoint_overwrite \
			${useImage:-$docker_image} \
			$execute_line
		set +x
	done
}

swarm_service_update() {
	servName=$1
	read docker_image <<< $(unpack \$service_${servName}_docker_image)
	echo "Updating swarm serivce $servName to $docker_image ..."
	set -x
	$DOCKER service update \
		--force \
		--update-order=start-first \
		--with-registry-auth \
		--update-failure-action rollback \
		--with-registry-auth \
		--image $docker_image \
		$servName
	set +x
}
