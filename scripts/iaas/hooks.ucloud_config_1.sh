#!/bin/bash
hookfun="$@"

install_fuse() {
	apt-get install -y --no-install-recommends reiserfsprogs
}

umount_vdisk() {
	mkdir -p /var/tmp/vdisk
	cd /var/tmp/vdisk

	if mount | grep -q vdisk; then
		umount ./mnt
	fi
	[ -e ./mnt ] && rmdir ./mnt
}

make_and_mount_vdisk() {
	DISKSIZE=$1

	mkdir -p /var/tmp/vdisk
	cd /var/tmp/vdisk

	dd if=/dev/zero of=vdisk.img count=${DISKSIZE} bs=1024K
	mkfs.reiserfs -ff ./vdisk.img

	mkdir -p ./mnt
	mount -t reiserfs ./vdisk.img ./mnt
}

vdisk_producer_loop() {
	DISKSIZE=$1
	while true; do
		echo 'Obtaining lock ...'
		(
			flock --wait 5 100 || exit 1
			echo 'Lock obtained!'

			if [ -z "$(ls -A /var/tmp/vdisk/mnt)" ]; then
				echo 'No indites found, continue to wait ...'
				exit 0
			fi

			umount_vdisk

			if [ -e vdisk.img ]; then
				rm -f vdisk.*.img
				mv vdisk.img vdisk.$(date +'%Y%m%d-%H%M%S').img
			fi

			make_and_mount_vdisk $DISKSIZE

		) 100>/var/tmp/vdisk/vdisk.lock

		sleep 5
	done
}

vdisk_producer_daemon() {
	DISKSIZE=$1
	# Use the following command in container:
	# (flock 100; indexer.out -o /mnt/vdisk/mnt/; sync ) 100>/mnt/vdisk/vdisk.lock

	( # ensure whenever ./mnt presents, it is mounted.
		flock 100
		umount_vdisk
		make_and_mount_vdisk $DISKSIZE
	) 100>/var/tmp/vdisk/vdisk.lock

	declare -fx umount_vdisk make_and_mount_vdisk vdisk_producer_loop
	nohup bash -c "vdisk_producer_loop $DISKSIZE" &
}

$hookfun
