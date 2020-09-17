const express = require('express')
const proxy = require('express-http-proxy')

const port = 8089
const dev_watch_port = 19985
const http_dir = '../ui/dist'

process.on('SIGINT', function() {
  console.log('')
  console.log('Bye bye.')
  process.exit()
})

var app = express()

/* UI http server */

/* indexer proxy */
app.use('/indexer', proxy('0.0.0.0:8934', {
  proxyReqPathResolver: function (req) {
    return '/index'
  }
}))

/* searchd proxy */
app.use('/searchd', proxy('0.0.0.0:8921', {
  proxyReqPathResolver: function (req) {
    return '/search'
  }
}))

/* jobd proxy (order matters: must be at bottom) */
app.use('/get', proxy('0.0.0.0:8964', {
  proxyReqPathResolver: function (req) {
    //console.log('[originalUrl]', req.originalUrl)
    return req.originalUrl
  }
}))

/* jobd proxy (order matters: must be at bottom) */
app.use('/runjob', proxy('0.0.0.0:8964', {
  proxyReqPathResolver: function (req) {
    //console.log('[originalUrl]', req.originalUrl)
    return req.originalUrl
  }
}))


const choose_UI_proxy = new Promise((resolve, reject) => {
  /* test if webpack is watching mode */
  let server = app.listen(dev_watch_port)

  .on('error', function (err) {
    /* yes, it is watching mode (dev mode) */
    console.log('dev/watch mode')
    server.close()
    app.use('/', proxy(`0.0.0.0:${dev_watch_port}`))
    resolve()
  })
  .on('listening', function () {
    /* no, it is static HTML files (deploy mode) */
    console.log('deploy/static mode')
    app.use(express.static(http_dir))
    resolve()
  })
})

choose_UI_proxy.then(() => {
  app.listen(port)
  console.log(`Listen on ${port}`)
})
