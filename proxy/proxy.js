const express = require('express')
const proxy = require('express-http-proxy')

const port = 8089
const http_dir = '../ui/dist'

process.on('SIGINT', function() {
  console.log('')
  console.log('Bye bye.')
  process.exit()
})

var app = express()

/* UI http server */
app.use(express.static(http_dir))

/* indexer proxy */
app.use('/indexer', proxy('0.0.0.0:8934', {
  proxyReqPathResolver: function (req) {
    console.log('[origin baseUrl]', req.baseUrl)
    return '/index'
  }
}))

/* searchd proxy */
app.use('/searchd', proxy('0.0.0.0:8921', {
  proxyReqPathResolver: function (req) {
    console.log('[origin baseUrl]', req.baseUrl)
    return '/search'
  }
}))

/* jobd proxy (order matters: must be at bottom) */
app.use('/', proxy('0.0.0.0:8964'))

app.listen(port)
console.log(`Listen on ${port}`)
