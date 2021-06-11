slot=$TASK_SLOT
export PATH="$PATH:/code"
cd /data

TOTAL_MSE_CRAWLERS=9
while true; do
	case $slot in

		1)
			crawler-stackexchange.py --site mse --crawler 1/$TOTAL_MSE_CRAWLERS
		;;

		2)
			crawler-stackexchange.py --site mse --crawler 2/$TOTAL_MSE_CRAWLERS
		;;

		3)
			crawler-stackexchange.py --site mse --crawler 3/$TOTAL_MSE_CRAWLERS
		;;

		4)
			crawler-stackexchange.py --site mse --crawler 4/$TOTAL_MSE_CRAWLERS
		;;

		5)
			crawler-stackexchange.py --site mse --crawler 5/$TOTAL_MSE_CRAWLERS
		;;

		6)
			crawler-stackexchange.py --site mse --crawler 6/$TOTAL_MSE_CRAWLERS
		;;

		7)
			crawler-stackexchange.py --site mse --crawler 7/$TOTAL_MSE_CRAWLERS
		;;

		8)
			crawler-stackexchange.py --site mse --crawler 8/$TOTAL_MSE_CRAWLERS
		;;

		9)
			crawler-stackexchange.py --site mse --crawler 9/$TOTAL_MSE_CRAWLERS
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
