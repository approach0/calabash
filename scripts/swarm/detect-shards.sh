#!/bin/bash

detect_shards() {
	servName=$1
	minShard=${2-3}

	list=""
	cnt=0
	for name in $servName $servName-shard{2..99}; do
		ping -c 1 -W 3 $name
		[ ! $? -eq 0 ] && break
		list="$name $list"
		let "cnt = cnt + 1"
	done

	if [ $cnt -lt $minShard ]; then
		echo ""
	else
		echo $list
	fi
}