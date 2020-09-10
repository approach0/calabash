<template>
<h3>Hello</h3>
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
