var fs = require("graceful-fs")
var loggers = {}

const PAGE_LEN = 200
const LOG_DIR  = '/var/tmp/jobd'

/* two page buffer */
function loggerEach(name, callbk, select) {
  if (!fs.existsSync(LOG_DIR))
    fs.mkdirSync(LOG_DIR)

  let file0 = LOG_DIR + '/' + name + '.0.log'
  let file1 = LOG_DIR + '/' + name + '.1.log'
  if (select === undefined)
    return [file0, file1].forEach(callbk)
  else if (select == 0)
    return [file0].forEach(callbk)
  else
    return [file1].forEach(callbk)
}

/* get logger */
function loggerGet(name) {
  let logger = loggers[name]
  if (logger == undefined) {
    logger = loggers[name] = {
      'prev': undefined,
      'cnt': 0
    }
  }
  return logger
}

/* log data for name */
function loggerWrite(name, data) {
  let logger = loggerGet(name)
  /* next virtual line */
  logger['cnt'] = (1 + logger['cnt']) % (2 * PAGE_LEN)
  /* get writting page */
  let now = parseInt(logger['cnt'] / PAGE_LEN)

  if (logger['prev'] === undefined) {
    /* create both files */
    loggerEach(name, function (f) {
      fs.closeSync(fs.openSync(f, 'w'))
      fs.truncateSync(f)
    })
  } else if (now !== logger['prev']) {
    /* clear current files */
    loggerEach(name, function (f) {
      fs.closeSync(fs.openSync(f, 'w'))
      fs.truncateSync(f)
    }, now)
  }

  /* write current files */
  loggerEach(name, function (f) {
    fs.appendFileSync(f, data)
  }, now)

  logger['prev'] = now
}

/* read data from filepath to callback onData */
function file_read(filepath, onData) {
  try{
    fs.accessSync(filepath, fs.F_OK)
  } catch(e) {
    throw new Error(`log for ${name} is not found.`)
  }
  const content = fs.readFileSync(filepath, "utf8")
  onData(content)
}

/* read log in ordered pages */
function loggerRead(name, onData, onEnd) {
  let logger = loggerGet(name)
  let now = parseInt(logger['cnt'] / PAGE_LEN)
  /* read old page */
  loggerEach(name, function (f) {
    file_read(f, onData)
  }, (now + 1) % 2)
  /* read new page */
  loggerEach(name, function (f) {
    file_read(f, onData)
  }, now)

  onEnd && onEnd()
}

/* write API */
exports.write = function (jobname, output) {
  output.split('\n').forEach(function (line) {
    const timenow = new Date().toLocaleString()
    let logline = timenow + ' | ' + line

    /* log to file */
    loggerWrite(jobname, logline + '\n')
  })
}

/* read API */
exports.read = function (jobname, onData, onEnd) {
  loggerRead(jobname, onData, onEnd)
}

if (require.main === module) {
  for (var i = 0; i < 100; i++) {
    exports.write('test', `line${i}`)
  }
  exports.read('test',
    data => {
      process.stdout.write(data)
    },
    () => { console.log('end') }
  )
}
