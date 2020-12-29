slot=$TASK_SLOT
export PATH="$PATH:/code"
cd /data

while true; do
	case $slot in

		1)
			crawler-stackexchange.py --site mse --begin-page 1 --end-page 3000
		;;

		2)
			crawler-stackexchange.py --site mse --begin-page 3001 --end-page 6000
		;;

		3)
			crawler-stackexchange.py --site mse --begin-page 6001 --end-page 9000
		;;

		4)
			crawler-stackexchange.py --site mse --begin-page 9001 --end-page 12000
		;;

		5)
			crawler-stackexchange.py --site mse --begin-page 12001 --end-page 15000
		;;

		6)
			crawler-stackexchange.py --site mse --begin-page 15001 --end-page 18000
		;;

		7)
			crawler-stackexchange.py --site mse --begin-page 18001 --end-page 21000
		;;

		8)
			crawler-stackexchange.py --site mse --begin-page 21001 --end-page 24000
		;;

		9)
			crawler-stackexchange.py --site mse --begin-page 24001 --end-page 27000
		;;

		10)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 3 # Middle School
		;;

		11)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 4 # High School
		;;

		12)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 5 # Contests and Programs
		;;

		13)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 6 # High School Olympiads
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 1068820 # Old High School Olympiads
		;;

		14)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 7 # College Math
		;;

		15)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 163 # Computer Science and Info.
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 164 # Physics
		;;

		16)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 129 # American Regions Math League (ARML)
		;;

		17)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 594864 # AoPS Mock Contests
		;;

		18)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 123 # USA Math Talent Search (USMTS)
		;;

		19)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 140 # PUMaC (Princeton)
		;;

		20)
			crawler-artofproblemsolving.com.py -n 0 -o 3650 -c 129 # Harvard-MIT (HMMT)
		;;

		*)
			echo "SLOT#${slot} is not handled!"
		;;

	esac

	echo "Start over ..."
	sleep 32
done
