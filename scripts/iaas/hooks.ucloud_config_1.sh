#!/bin/bash
hookfun="$@"

install_fuse() {
	apt-get install -y --no-install-recommends reiserfsprogs
}

mount_vdisk() {
	cd /var/tmp/vdisk

	mkdir -p ./mnt
	mount -t reiserfs ./vdisk.img ./mnt
}

umount_vdisk() {
	cd /var/tmp/vdisk

	if mount | grep -q vdisk; then
		umount ./mnt
	fi
	[ -e ./mnt ] && rmdir ./mnt
}

create_vdisk() {
	DISKSIZE=$1

	cd /var/tmp/vdisk

	dd if=/dev/zero of=vdisk.img count=${DISKSIZE} bs=1024K
	mkfs.reiserfs -ff ./vdisk.img
}

vdisk_producer_loop() {
	DISKSIZE=$1
	while true; do
		#echo 'Obtaining lock ...'
		(
			flock --wait 5 100 || exit 1
			echo 'Lock obtained! Creating a new vdisk.img'

			mnt_contents="$(ls -A /var/tmp/vdisk/mnt)"
			umount_vdisk

			if [[ -e vdisk.img && -n "$mnt_contents" ]]; then
				prod_img=vdisk.$(date +'%Y%m%d-%H%M%S').img
				echo "Producing a new production image: $prod_img"
				rm -f vdisk.*.img
				mv vdisk.img $prod_img
			fi

			create_vdisk $DISKSIZE
			mount_vdisk

		) 100>/var/tmp/vdisk/vdisk.lock

		sleep 5
	done
}

vdisk_producer_daemon() {
	DISKSIZE=$1
	# Use the following command in container:
	# (flock 100; indexer.out -o /mnt/vdisk/mnt/; sync ) 100>/mnt/vdisk/vdisk.lock

	mkdir -p /var/tmp/vdisk
	declare -fx umount_vdisk create_vdisk mount_vdisk vdisk_producer_loop
	nohup bash -c "vdisk_producer_loop $DISKSIZE" &> /var/tmp/vdisk/nohup.out < /dev/null &
}

vdisk_consume_loop() {
	cd /var/tmp/vdisk

	while true; do
		#echo 'Obtaining lock ...'
		(
			flock --wait 5 100 || exit 1
			echo 'Lock obtained!'

			if ls vdisk.*.img; then
				prod_img=$(ls vdisk.*.img | head -1)
				echo "Mount a new production image: $prod_img"
				umount_vdisk
				mv $prod_img vdisk.img
				rm -f vdisk.*.img
				mount_vdisk
			fi

		) 100>/var/tmp/vdisk/vdisk.lock

		sleep 5
	done
}

vdisk_consume_daemon() {
	# Use the following command in container:
	# (flock 100; searchd.out -i /mnt/vdisk/mnt/) 100>/mnt/vdisk/vdisk.lock

	mkdir -p /var/tmp/vdisk
	swapoff -a # maybe swap is not suitable for search nodes?
	#cat /proc/swaps

	declare -fx umount_vdisk create_vdisk mount_vdisk vdisk_consume_loop
	nohup bash -c "vdisk_consume_loop" &> /var/tmp/vdisk/nohup.out < /dev/null &
}

$hookfun
