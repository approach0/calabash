<template>
<v-app>

  <v-app-bar color="deep-purple" dark app>
    <template>
    <v-app-bar-nav-icon>
      <v-icon @click="drawer = !drawer">featured_play_list</v-icon>
    </v-app-bar-nav-icon>

    <v-toolbar-title>Approach Zero Panel</v-toolbar-title>

    <v-spacer></v-spacer>

    rightmost
    </template>
  </v-app-bar>

  <v-navigation-drawer width="600" v-model="drawer" color="purple darken-4 white--text" dark app>
    <v-container>

        <v-text-field v-model="job_input" label="Run job" append-icon="sports" @click:append="clickRun" filled clearable>
        </v-text-field>

        <v-card class="grey darken-4 console" v-bind:loading="console_loading">{{console_content}}</v-card>

        <v-row>
          <v-chip class="ma-2" color="purple white--text">
            <v-icon>star</v-icon> Hello
          </v-chip>
        </v-row>

    </v-container>
  </v-navigation-drawer>

  <v-main app>

    <v-container>
    content
    </v-container>
  </v-main>

  <v-footer color="deep-purple" dark app>
  footer
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
      console_jobname: 'master',
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
      vm.fetch_log()
    }, 1000)
  },

  methods: {
    random_idx(L) {
      return Math.floor(Math.random() * L)
    },

    fetch_log() {
      let vm = this
      vm.console_loading = true

      console.log(`http://0.0.0.0:${port}/get/log/_master_`)
      axios.get(`http://0.0.0.0:${port}/get/log/_master_`)
      .then(function (res) {
        const data = res.data
        vm.console_content = data['logdata']
        vm.console_jobname = data['jobname']
        vm.console_loading = false
      })
      .catch(function (err) {
        console.log(err);
      });
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
  max-height: 900px;
}
</style>
