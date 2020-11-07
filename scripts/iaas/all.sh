#!/bin/bash
SCRIPT_DIR=$(dirname ${BASH_SOURCE[0]})
source ${SCRIPT_DIR}/../common.env.sh # for `unpack'

for envvar in ${!iaas_providers_@}; do
	provider=${!envvar}
	echo "source provider: $provider"
	if [ $provider == linode ]; then
		. $SCRIPT_DIR/linode.sh `unpack \$iaas_linode_{docker_image,token,docker_registry_url,docker_registry_user,docker_registry_pass}`
	elif [ $provider == ucloud ]; then
		. $SCRIPT_DIR/ucloud.sh `unpack \$iaas_ucloud_{docker_image,pubkey,prikey,docker_registry_url,docker_registry_user,docker_registry_pass}`
	else
		echo "ERROR: provider '$provider' not implemented."
		exit 1
	fi
done

iaas_node_list_in_json() {
	acc_file=`mktemp`
	echo '[]' > $acc_file
	for envvar in ${!iaas_providers_@}; do
		provider=${!envvar}
		tmp_file=`mktemp`
		if [ $provider == linode ]; then
			${provider}_node_list_in_json | python -c "if True:
			import json, sys
			j = json.load(sys.stdin)
			def mapfun(x):
				region = x['region']
				specs = x['specs']
				specs = '-'.join([k + str(specs[k]) for k in specs.keys()])
				image = x['image'].split('/')[-1]
				return {
					'provider': 'linode',
					'id': x['id'],
					'label': x['label'],
					'status': x['status'],
					'ip': x['ipv4'],
					'description': f'{region}/{specs}/{image}',
					'create_time': x['created']
				}
			print(json.dumps(list(map(mapfun, j))))
			"  2>/dev/null >$tmp_file
		elif [ $provider == ucloud ]; then
			${provider}_node_list_in_json | python -c "if True:
			import json, sys
			j = json.load(sys.stdin)
			def mapfun(x):
				region = x['Zone']
				specs = x['Config'].replace(' ', '|') + '|' + x['DiskSet']
				image = x['Image'].split('|')[-1].replace(' ', '-')
				return {
					'provider': 'ucloud',
					'id': x['ResourceID'],
					'label': x['UHostName'],
					'status': x['State'],
					'ip': [x['PublicIP'], x['PrivateIP']],
					'description': f'{region}/{specs}/{image}',
					'create_time': x['CreationTime']
				}
			print(json.dumps(list(map(mapfun, j))))
			"  2>/dev/null >$tmp_file
		else
			echo "ERROR: provider '$provider' not implemented."
		fi
		out_file=`mktemp`
		jq -s '.[0] + .[1]' $acc_file $tmp_file > $out_file
		rm -f $tmp_file
		mv $out_file $acc_file
	done
	cat $acc_file
	rm -f $acc_file
}
