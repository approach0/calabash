/*
 * The default export for the vue NPM package is
 * runtime only, as here we need the template compiler,
 * we include vue in the following way, which includes
 * both the runtime and the template compiler.
 */
import Vue from 'vue'
/* close console.log on production tips */
Vue.config.productionTip = false

import 'material-icons/iconfont/material-icons.css'

import App from './app.vue'

/* mount Vue */
new Vue({
  el: '#app',
  render: h => h(App)
})
