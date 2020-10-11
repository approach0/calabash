#!/bin/sh
hookfun="$@"

install_fuse() {
	apt-get install -y --no-install-recommends reiserfsprogs
}

creat_vdisk() {
	FILE_SYS=$1
	DISKSIZE=$2
	mkfs_opts="-ff"

	mkdir -p /var/tmp/vdisk
	cd /var/tmp/vdisk
	dd if=/dev/zero of=vdisk.img count=${DISKSIZE} bs=1024K
	mkfs.${FILE_SYS} ${mkfs_opts} ./vdisk.img
}

mount_vdisk() {
	FILE_SYS=$1
	MNT_IMG=$2
	mount_opts=""
	cd /var/tmp/vdisk
	mkdir -p ./mnt
	set -x
	mount -t ${FILE_SYS} ${mount_opts} ${MNT_IMG} ./mnt
	set +x
}

$hookfun
