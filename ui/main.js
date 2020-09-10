/*
 * The default export for the vue NPM package is
 * runtime only, as here we need the template compiler,
 * we include vue in the following way, which includes
 * both the runtime and the template compiler.
 */
import 'material-icons/iconfont/material-icons.css'

import Vue from 'vue'
/* close console.log on production tips */
Vue.config.productionTip = false

import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
Vue.use(Vuetify)

import App from './app.vue'

/* mount Vue */
new Vue({
  vuetify: new Vuetify(),
  render: h => h(App)
}).$mount('#app')
