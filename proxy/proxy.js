const express = require('express')
const proxy = require('express-http-proxy')

const port = 8080
const http_dir = '../ui/dist'

process.on('SIGINT', function() {
  console.log('')
  console.log('Bye bye.')
  process.exit()
})

var app = express()

/* UI http server */
app.use(express.static(http_dir))

/* jobd proxy */
app.use('/jobd', proxy('0.0.0.0:8964'))

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

app.listen(port)
console.log(`Listen on ${port}`)
