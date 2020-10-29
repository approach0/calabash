#!/bin/bash
SCRIPT_DIR=$(dirname ${BASH_SOURCE[0]})
source ${SCRIPT_DIR}/../common.env.sh # for `unpack'

for envvar in ${!iaas_providers_@}; do
	provider=${!envvar}
	echo "source provider: $provider"
	if [ $provider == linode ]; then
		. $SCRIPT_DIR/linode.sh `unpack \$iaas_linode_{docker_image,token,docker_mirror,docker_registry_user,docker_registry_pass}`
	elif [ $provider == ucloud ]; then
		. $SCRIPT_DIR/ucloud.sh `unpack \$iaas_ucloud_{docker_image,pubkey,prikey,docker_mirror,docker_registry_user,docker_registry_pass}`
	else
		echo "ERROR: provider '$provider' not implemented."
		exit 1
	fi
done

iaas_node_list_in_json() {
	for envvar in ${!iaas_providers_@}; do
		provider=${!envvar}
		if [ $provider == linode ]; then
			${provider}_node_list_in_json | python -c "if True:
			import json, sys
			j = json.load(sys.stdin)
			def mapfun(x):
				region = x['region']
				image = x['image'].split('/')[-1]
				specs = x['specs']
				specs = '-'.join([k + str(specs[k]) for k in specs.keys()])
				return {
					'provider': 'linode',
					'id': x['id'],
					'label': x['label'],
					'status': x['status'],
					'ip': x['ipv4'][0],
					'description': f'{region}/{specs}/{image}',
					'create_time': x['created']
				}
			print(list(map(mapfun, j)))
			"
		elif [ $provider == ucloud ]; then
			echo "..."
		else
			echo "ERROR: provider '$provider' not implemented."
			exit 1
		fi
	done
}
