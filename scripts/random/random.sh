#!/bin/bash
rname_short() {
	mktemp | awk -F'.' '{print $2}'
}

rname_uuid() {
	cat /proc/sys/kernel/random/uuid
}
