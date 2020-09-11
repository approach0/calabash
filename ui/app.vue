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

        <v-text-field v-model="job_input" label="Run job" append-icon="sports" @click:append="clickRun" filled clearable
                      v-on:keyup.enter="clickRun" :error-messages="input_err_msg" v-on:keyup="input_err_msg = null">
        </v-text-field>

        <v-row justify="space-around" class="flex-wrap">
          <v-switch v-model="console_refresh" label="Console refresh"></v-switch>
          <v-switch v-model="console_stickbt" label="Stick to bottom"></v-switch>
          <v-switch v-model="dry_run" label="Dry run"></v-switch>
          <v-switch v-model="single_job" label="Single job"></v-switch>
        </v-row>

        <v-row>
          <v-chip class="ma-2" :color="(jb == console_outsel) ? 'purple' : 'blue-grey'"
                  v-for="jb in console_starjob" :key="jb" @click="clickStar(jb)">
            <v-icon>star</v-icon> &nbsp; {{jb}}
          </v-chip>
        </v-row>

        <v-card id="console" class="grey darken-4 console"
         v-bind:loading="console_loading">{{console_content}}</v-card>

    </v-container>
  </v-navigation-drawer>

  <v-main app>
    <v-container>
      <v-card class="mx-auto" tile>
        <v-list shaped>
          <v-subheader>Tasks</v-subheader>

          <v-list-item-group color="primary">

            <v-list-item v-for="task in tasks" :key="task.taskid">

              <v-list-item-avatar>
                <v-icon>ballot</v-icon>
              </v-list-item-avatar>

              <v-list-item-content>
                <v-list-item-title> Task#{{task.taskid}} </v-list-item-title>
                <v-list-item-subtitle>

                  <v-chip class="ma-2" v-for="(job, index) in task.runList" :color="chip_color(job)" :key="index" label>
                   <v-avatar left> <v-icon>{{ chip_icon(job) }}</v-icon> </v-avatar>
                   {{job.jobname}}
                   <div style="font-size: 10px; padding-left: 10px">
                    (PID={{job.pid}} Exit={{job.exitcode}} Alive={{job.alive}})
                   </div>
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
const port = 8964

export default {
  data () {
    return {
      drawer: false,
      job_input: '',
      input_err_msg: null,
      single_job: false,
      dry_run: false,
      console_outsel: null,
      console_refresh: true,
      console_stickbt: true,
      console_loading: false,
      console_starjob: ['_master_'],
      console_content: '',
      tasks: [],
      debug: false,
    }
  },

  computed: {
  },

  watch: {
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
        vm.console_outsel = jobname

        var index = vm.console_starjob.indexOf(jobname)
        if (index === -1) {
          vm.console_starjob.push(jobname)
        }
      })
      .catch(function (err) {
        console.error(err)
      })
    },

    clickRun() {
      let vm = this
      let input = vm.job_input.trim()

      axios.post(`http://0.0.0.0:${port}/runjob`, {
        goal: input,
        dry_run: vm.dry_run,
        single_job: vm.single_job,
      })
      .then(function (res) {
        const data = res.data
        if ('error' in data) {
          vm.input_err_msg = "Job is not defined."
          return
        }

        vm.fetch_log(input)
      })
      .catch(function (err) {
        console.error(err)
      })
    },

    clickStar(jobname) {
      if (jobname !== '_master_')
        this.job_input = jobname
      this.console_outsel = jobname
    },

    update_tasks_list() {
      let vm = this
      axios.get(`http://0.0.0.0:${port}/get/tasks`)
      .then(function (res) {
        const data = res.data
        const tasks = data['all_tasks']
        vm.tasks = tasks.reverse()
      })
      .catch(function (err) {
        console.error(err)
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
