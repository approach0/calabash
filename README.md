### Bootstrap
First, run jobd server
```sh
node ./jobd/jobd.js --config ./config.toml
```

Then bootstrap the calabash to remote node using CLI
```sh
$ node cli.js -j swarm:bootstrap?iaascfg=ucloud_config_1
```
and at the end it will output the bootstrap node IP address, you can now manimuplate this remote calabash service, for example, expand a new node:
```sh
$ node cli.js http://<IP>:<PORT> -j 'swarm:expand?iaascfg=ucloud_config_1&role=worker&typeIP=private'
```

You can view the remote log by sepcifying a taskID
```sh
node cli.js http://106.75.167.207 --task-log 12
```
