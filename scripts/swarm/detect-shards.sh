#!/bin/bash

detect_shards() {
	servName=$1
	minShard=${2-4}

	list=""
	cnt=0
	for name in $servName $servName-shard{2..99}; do
		ping -c 1 -W 3 $name &> /dev/null
		[ ! $? -eq 0 ] && break
		list="$list $name"
		let "cnt = cnt + 1"
	done

	if [ $cnt -lt $minShard ]; then
		echo ""
	else
		echo $list
	fi
}
