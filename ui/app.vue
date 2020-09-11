<template>
<v-app>

  <v-app-bar color="deep-purple" dark app>
    <template>
    <v-app-bar-nav-icon>
      <v-icon @click="drawer = !drawer">featured_play_list</v-icon>
    </v-app-bar-nav-icon>

    <v-toolbar-title>Approach Zero Panel</v-toolbar-title>

    <v-spacer></v-spacer>

    <v-btn href="https://approach0.xyz" target="_blank" color="purple darken-1" dark>
      <v-icon>storefront</v-icon> &nbsp; Main Site
    </v-btn>

    </template>
  </v-app-bar>

  <v-navigation-drawer width="600" v-model="drawer" color="purple darken-4 white--text" dark app>
    <v-container>

        <v-text-field v-model="input" label="Run job" v-on:keyup.enter="clickRun" :error-messages="input_err_msg" v-on:keyup="input_err_msg = null"
        append-icon="clear" append-outer-icon="sports" @click:append="input = ''" @click:append-outer="clickRun">
        </v-text-field>

        <v-row>
          <v-chip class="ma-2" :color="(jb == console_outsel) ? 'purple' : 'blue-grey'"
                  v-for="jb in console_starjob" :key="jb" @click="clickStar(jb)">
            <v-icon>star</v-icon> &nbsp; {{jb}}
          </v-chip>
        </v-row>

        <v-row justify="center" v-if="Object.keys(job_description).length > 0">
          <v-card v-if="job_description" class="d-inline-block" light>
            <v-card-text>
            <p class="text-h5"> {{job_description['name']}} </p>
            <p v-for="(val, key) in job_description" v-if="key != 'name'" class="text-subtitle-2 text--primary">
              {{key}}: {{val}}
            </p>
            </v-card-text>
          </v-card>
        </v-row>

        <v-card id="console" class="grey darken-4 console"
         v-bind:loading="console_loading">{{console_content}}</v-card>

        <v-row justify="space-around" class="flex-wrap">
          <v-switch v-model="console_refresh" label="Console refresh"></v-switch>
          <v-switch v-model="console_stickbt" label="Stick to bottom"></v-switch>
          <v-switch v-model="dry_run" label="Dry run"></v-switch>
          <v-switch v-model="single_job" label="Single job"></v-switch>
        </v-row>

    </v-container>
  </v-navigation-drawer>

  <v-main app>
    <v-container>
      <v-parallax dark src="https://cdn.vuetifyjs.com/images/parallax/material2.jpg">
      <v-row align="center" justify="center">

        <v-col class="text-center" cols="4">
          <v-card>
            <v-img class="white--text align-end" height="200px" :src="img_mounted"></v-img>
            <v-card-title>Disk Volume</v-card-title>

            <v-card-subtitle v-if="status.mounted === null">Please wait ...</v-card-subtitle>
            <v-card-actions v-else>
              <v-btn color="red" text :disabled="!status.mounted" @click="changeStatus('mounted', 'world:say-world')">
                {{status.mounted ? 'Unmount' : 'Unmounted'}}
              </v-btn>
              <v-btn color="green" text :disabled="status.mounted" @click="changeStatus('mounted', 'world:say-world')">
                {{status.mounted ? 'Mounted' : 'Mount'}}
              </v-btn>
            </v-card-actions>

          </v-card>
        </v-col>

        <v-col class="text-center" cols="4">
          <v-card>
            <v-img class="white--text align-end" height="200px" :src="img_indexer"></v-img>
            <v-card-title>Indexer</v-card-title>

            <v-card-subtitle v-if="status.indexer === null">Please wait ...</v-card-subtitle>
            <v-card-actions v-else>
              <v-btn color="red" text :disabled="!status.indexer" @click="changeStatus('indexer', 'world:say-world')">
                {{status.indexer ? 'Stop' : 'Stopped'}}
              </v-btn>
              <v-btn color="green" text :disabled="status.indexer" @click="changeStatus('indexer', 'world:say-world')">
                {{status.indexer ? 'Running' : 'Run'}}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col class="text-center" cols="4">
          <v-card>
            <v-img class="white--text align-end" height="200px" :src="img_searchd"></v-img>
            <v-card-title>Search Daemon</v-card-title>

            <v-card-subtitle v-if="status.searchd === null">Please wait ...</v-card-subtitle>
            <v-card-actions v-else>
              <v-btn color="red" text :disabled="!status.searchd" @click="changeStatus('searchd', 'world:say-world')">
                {{status.searchd ? 'Stop' : 'Stopped'}}
              </v-btn>
              <v-btn color="green" text :disabled="status.searchd" @click="changeStatus('searchd', 'world:say-world')">
                {{status.searchd ? 'Running' : 'Run'}}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

      </v-row>
  </v-parallax>

      <v-divider inset style="margin: 15px"></v-divider>

      <v-card class="mx-auto" tile>
        <v-list shaped flat>
          <v-subheader>{{tasks.length == 0 ? 'No tasks' : 'Tasks'}}</v-subheader>

          <v-list-item-group color="primary">

            <v-list-item v-for="task in tasks" :key="task.taskid">

              <v-list-item-avatar>
                <v-icon>ballot</v-icon>
              </v-list-item-avatar>

              <v-list-item-content>
                <v-list-item-title> Task#{{task.taskid}} </v-list-item-title>
                <v-list-item-subtitle>

                  <v-chip class="ma-2" v-for="(job, index) in task.runList" :key="index"
                          @click="clickJob(job)" :color="chip_color(job)" label>
                   <v-avatar left> <v-icon>{{ chip_icon(job) }}</v-icon> </v-avatar>
                   {{job.jobname}}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item-content>

            </v-list-item>

          </v-list-item-group>
        </v-list>
      </v-card>
    </v-container>
  </v-main>

  <v-footer color="deep-purple" dark app>
    <v-row justify="center">
      <strong>Approach0</strong>&nbsp; - &nbsp; {{ new Date().getFullYear() }}
    </v-row>
  </v-footer>

</v-app>
</template>

<script>
import axios from 'axios'
import moment from 'moment'

const merge = require('utils-merge')
const port = 8964

export default {
  data () {
    return {
      img_mounted: require('./assets/disk.jpg'),
      img_indexer: require('./assets/index.jpg'),
      img_searchd: require('./assets/search.jpg'),
      drawer: false,
      input: '',
      input_err_msg: null,
      single_job: false,
      dry_run: false,
      job_description: {},
      console_outsel: null,
      console_refresh: true,
      console_stickbt: true,
      console_loading: false,
      console_starjob: ['_master_'],
      console_content: '',
      status: {
        "mounted": false,
        "indexer": false,
        "searchd": false
      },
      tasks: []
    }
  },

  computed: {
  },

  watch: {
    input: function (newVal, oldVal) {
      const val = newVal.trim()
      this.getJobDescription(val)
    }
  },

  mounted: function () {
    let vm = this
    setInterval(function () {
      const recent_job = vm.console_outsel || vm.console_starjob[0]
      if (vm.console_refresh) {
        vm.fetch_log(recent_job)
      }

      vm.update_tasks_list()
    }, 1000)
  },

  methods: {
    chip_color(job) {
      if (job.alive)
        return 'blue'
      else if (job.exitcode == 0)
        return 'green'
      else if (job.pid < 0)
        return 'grey'
      else
        return 'red'
    },

    chip_icon(job) {
      if (job.alive)
        return 'cached'
      else if (job.exitcode == 0)
        return 'done'
      else if (job.pid < 0)
        return 'timer'
      else
        return 'error'
    },

    fetch_log(jobname) {
      let vm = this
      vm.console_loading = true

      if (this.console_stickbt) {
        var element = document.getElementById("console")
        element.scrollTop = element.scrollHeight
      }

      axios.get(`http://0.0.0.0:${port}/get/log/${jobname}`)
      .then(function (res) {
        const data = res.data
        vm.console_content = data['logdata']
        vm.console_loading = false

        var index = vm.console_starjob.indexOf(jobname)
        if (index === -1) {
          vm.console_starjob.push(jobname)
        }
      })
      .catch(function (err) {
        console.error(err)
      })
    },

    run(jobname, manual) {
      let vm = this
      axios.post(`http://0.0.0.0:${port}/runjob`, {
        goal: jobname,
        dry_run: manual && vm.dry_run,
        single_job: manual && vm.single_job,
      })
      .then(function (res) {
        const data = res.data

        if (manual) {
          if ('error' in data) {
            vm.input_err_msg = "Job is not defined."
            return
          }

          vm.fetch_log(jobname)
        }
      })
      .catch(function (err) {
        console.error(err)
      })
    },

    clickRun() {
      let input = this.input.trim()
      this.run(input, true)
    },

    clickStar(jobname) {
      if (jobname !== '_master_')
        this.input = jobname
      this.console_outsel = jobname
    },

    getJobDescription(jobname) {
      let vm = this
      let job = {
        'name': jobname
      }
      axios.get(`http://0.0.0.0:${port}/get/job/${jobname}`)
      .then(function (res) {
        const data = res.data
        if ('error' in data) {
          vm.job_description = {}
          return
        }
        job = merge(data.props, job)
        vm.job_description = merge(job, vm.job_description)
      })
      .catch(function (err) {
        vm.job_description = {}
        console.error(err)
      })
    },

    clickJob(job) {
      this.drawer = true
      this.input = job.jobname

      this.getJobDescription(job.jobname)
      this.$set(this.job_description, 'pid', '' + job.pid + ' (' + (job.alive ? 'alive' : 'dead') + ')')
      //this.$set(this.job_description, 'alive', job.alive)
      this.$set(this.job_description, 'exitcode', job.exitcode)

      //this.$set(this.job_description, 'spawn_time', job.spawn_time)
      //this.$set(this.job_description, 'exit_time', job.exit_time)
      const start_moment = moment(job.spawn_time)
      const time_cost = moment(job.exit_time).from(start_moment, true)
      this.$set(this.job_description, 'start time', start_moment.fromNow())
      this.$set(this.job_description, 'time cost', time_cost)
    },

    update_tasks_list() {
      let vm = this
      axios.get(`http://0.0.0.0:${port}/get/tasks`)
      .then(function (res) {
        const data = res.data
        const tasks = data['all_tasks']
        vm.tasks = tasks.reverse()

        vm.updateStatus(vm.tasks[0])
      })
      .catch(function (err) {
        console.error(err)
      })
    },

    changeStatus(key, goal) {
      let vm = this
      vm.status[key] = null

      vm.run(goal)
    },

    updateStatus(task) {
      let vm = this
      task.runList.forEach(item => {
        switch (item.jobname) {
        case 'world:say-world':
          vm.status.mounted = (item.exitcode == 0) ? true : false
          break
        case 'world:say-world':
          vm.status.indexer = (item.exitcode == 0) ? true : false
          break
        case 'hello:say-world':
          vm.status.searchd = (item.exitcode == 0) ? true : false
          break
        }
      })
    }
  }
}
</script>

<style>
.console {
  margin-top: 20px;
  white-space: pre-wrap;
  overflow: auto;
  font-size: 14px;
  height: 60vh;
  padding: 8px;
}
</style>
