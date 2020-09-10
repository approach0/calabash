<template>
<v-app>hello world</v-app>
</template>

<script>
import axios from 'axios'

export default {
  data () {
    return {
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
