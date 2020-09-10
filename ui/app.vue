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

        <v-text-field v-model="job_input" label="Run job" append-icon="sports" @click:append="clickRun" filled clearable>
        </v-text-field>

        <v-row>
          <v-chip class="ma-2" color="purple white--text" v-for="jobname in console_starjob" :key="jobname">
            <v-icon>star</v-icon> &nbsp; {{jobname}}
          </v-chip>
        </v-row>

        <v-card class="grey darken-4 console" v-bind:loading="console_loading">{{console_content}}</v-card>

    </v-container>
  </v-navigation-drawer>

  <v-main app>

    <v-container>
    content
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
      console_loading: false,
      console_starjob: ['_master_'],
      console_content: '',
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
      const recent_job = vm.console_starjob[0]
      vm.fetch_log(recent_job)
    }, 1000)
  },

  methods: {
    random_idx(L) {
      return Math.floor(Math.random() * L)
    },

    fetch_log(jobname) {
      let vm = this
      vm.console_loading = true

      axios.get(`http://0.0.0.0:${port}/get/log/${jobname}`)
      .then(function (res) {
        const data = res.data
        vm.console_content = data['logdata']
        vm.console_loading = false

        var index = vm.console_starjob.indexOf(jobname)
        if (index === -1) {
          vm.console_starjob.push(jobname)
        } else {
          vm.console_starjob.splice(index, 1)
          vm.console_starjob.unshift(jobname)
        }
      })
      .catch(function (err) {
        console.log(err)
      })
    },

    clickRun() {
    }
  }
}
</script>

<style>
.console {
  white-space: pre-wrap;
  overflow: auto;
  font-size: 14px;
  height: 85vh;
}
</style>
