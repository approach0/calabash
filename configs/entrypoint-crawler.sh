shard=$1
export PATH="$PATH:/code"
cd /data

while true; do
	case $shard in

		1)
			crawler-math.stackexchange.com.py --begin-page 1 --end-page 3000
		;;

		2)
			crawler-math.stackexchange.com.py --begin-page 3001 --end-page 6000
		;;

		3)
			crawler-math.stackexchange.com.py --begin-page 6001 --end-page 9000
		;;

		4)
			crawler-math.stackexchange.com.py --begin-page 9001 --end-page 12000
		;;

		5)
			crawler-math.stackexchange.com.py --begin-page 12001 --end-page 15000
		;;

		6)
			crawler-math.stackexchange.com.py --begin-page 15001 --end-page 18000
		;;

		7)
			crawler-math.stackexchange.com.py --begin-page 18001 --end-page 21000
		;;

		8)
			crawler-math.stackexchange.com.py --begin-page 21001 --end-page 24000
		;;

		9)
			crawler-math.stackexchange.com.py --begin-page 24001 --end-page 27000
		;;

		10)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 3
		;;

		11)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 4
		;;

		12)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 5
		;;

		13)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 6
		;;

		14)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 7
		;;

		15)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 123
		;;

		16)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 163
		;;

		*)
			echo "shard#`${shard}` is not handled!"
		;;

	esac

	echo "Start over ..."
	sleep 32
done
