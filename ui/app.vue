<template>
<v-app>

  <v-app-bar color="deep-purple" dark app>
    <template>
    <v-app-bar-nav-icon>
      <v-icon @click="drawer = !drawer">menu</v-icon>
    </v-app-bar-nav-icon>

    <v-toolbar-title>Approach0 Panel</v-toolbar-title>

    <v-spacer></v-spacer>

    rightmost
    </template>
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" color="purple darken-4 white--text" dark app>
    <v-container>
    drawer
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

export default {
  data () {
    return {
      drawer: false,
      debug: false,
    }
  },

  computed: {
  },

  watch: {
  },

  mounted: function () {
  },

  methods: {
    random_idx(L) {
      return Math.floor(Math.random() * L)
    },
  }
}
</script>

<style>
</style>
