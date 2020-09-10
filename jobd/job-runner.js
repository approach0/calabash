const jobs_ldr = require('./jobs-ldr.js')
const logger = require('./logger.js')
const tasks = require('./tasks.js')
const extend = require('util')._extend
const process_ = require('process')
const pty = require('node-pty-prebuilt-multiarch')
const childProcess = require('child_process')

function masterLog(line) {
  logger.write('_master_', line)
  console.log(line)
}

function slaveLog(jobname, line) {
  logger.write(jobname, line)
  logger.write('_master_', line)
  console.log(jobname + ' |', line)
}

exports.syncLoop = function (arr, doing, done) {
  let idx = 0
  let loop = {
    next: function () {
      if (idx + 1 < arr.length) {
        idx = idx + 1
        doing(arr, idx, loop)
      } else {
        done(arr, arr.length - 1, loop, true)
      }
    },

    again: function () {
      doing(arr, idx, loop)
    },

    brk: function () {
      done(arr, arr.length - 1, loop, false)
    }
  }

  loop.again()
}

exports.getRunList = async function (jobs, target) {
  const deps = jobs.depGraph.dependenciesOf(target)
  deps.push(target)
  return deps
}

exports.spawn = function (cmd, opt, onLog, onSpawn, onExit)
{
  /* choose between pty.spawn and childProcess.spawn */
  let spawnFun = pty.spawn
  let stdout = function (o) {return o}
  let stderr = function (o) {return {'on': function (d) {}}}
  let stdin  = function (o) {return o}
  let stdlog = function (o) {onLog(o)}

  if (opt.spawn == 'direct') {
    spawnFun = childProcess.spawn
    stdout = function (o) {return o.stdout}
    stderr = function (o) {return o.stderr}
    stdin  = function (o) {return o.stdin}
    stdlog = function (o) {onLog(o.toString())}
  } else if (opt.spawn != 'pty') {
    onLog('[ error ] spawn method unrecognized.')
  }

  /* get gid/uid numbers */
  let uid = 0
  let gid = 0
  if (opt.user != 'root') {
    uid = process_.getuid()
    gid = process_.getgid()
  }

  return new Promise((resolve, reject) => {
    /* spawn runner process */
    const runner = spawnFun('/bin/sh', ['-c', cmd], {
      uid, gid,
      'cwd': opt.cwd,
      'env': opt.env,
      'cols': 80,
      'rows': 30,
      'name': 'xterm-color'
    })

    /* invoke onSpawn */
    onSpawn(cmd, runner.pid)

    /* pipe stdin into this process */
    process.stdin.pipe(stdin(runner))

    /* output std & stderr */
    stdout(runner).on('data', stdlog)
    stderr(runner).on('data', stdlog)

    /* error handler for std & stderr */
    stdout(runner).on('error', function () {})
    stderr(runner).on('error', function () {})
    stdin(runner).on('error', function () {})

    /* on exit ... */
    runner.on('exit', function (exitcode) {
      process.stdin.unpipe(stdin(runner))
      process.stdin.resume()
      process.stdin.pause()

      /* callback */
      onExit(cmd, exitcode)
    })
  })
}

exports.runjob = async function (jobs, jobname, onSpawn, onExit, onAbort) {
  const targetProps = jobs.depGraph.getNodeData(jobname)
  const cmd = targetProps['exe'] || ''
  const cwd = targetProps['cwd'] || '.'
  const user = targetProps['user'] || 'current'
  const spawn = targetProps['spawn'] || 'direct'

  if (cmd === '') {
    onExit(cmd, 0)
    return
  }

  /* prepare spawn environment */
  const onLog = function (lines) {
    lines.split('\n').forEach(function (line) {
      slaveLog(jobname, line)
    })
  }

  const defaultEnv = {
    'PATH': process.env['PATH'],
    'USER': user,
    'USERNAME': user,
    'HOME': (user == 'root') ? '/root' : '/home/' + user,
    'SHELL': '/bin/sh'
  }
  const jobEnv = jobs['envs'] || {}
  const allEnv = extend(defaultEnv, jobEnv)

  const opts = {
    'env': allEnv,
    'cwd': cwd,
    'user': user,
    'group': user,
    'spawn': spawn
  }

  /* main command */
  if (targetProps['if']) {
    const ifcmd = targetProps['if']
    await exports.spawn(ifcmd, opts, onLog, onSpawn, function (_, exitcode) {
      onExit(ifcmd, exitcode) /* call default routine */

      if (exitcode != 0) {
        onAbort()
        return
      }
    })

  } else if (targetProps['if_not']) {
    const incmd = targetProps['if_not']
    await exports.spawn(incmd, opts, onLog, onSpawn, function (_, exitcode) {
      onExit(incmd, exitcode) /* call default routine */

      if (exitcode == 0) {
        onAbort()
        return
      }
    })
  }

  /* main command */
  exports.spawn(cmd, opts, onLog, onSpawn, onExit)
}

exports.runlist = function (jobs, runList, _dryrun, onComplete) {
  const dryrun = _dryrun || false

  /* start printing */
  {
    let list_job_names = runList.join(', ')
    masterLog(`[ job list ] ${list_job_names}.`)
  }

  /* main loop */
  exports.syncLoop(runList,

    /* doing loop */
    function (_, idx, loop) {
      let jobname = runList[idx]
      let props = jobs.depGraph.getNodeData(jobname)

      /* recursive calling runlist for ref jobs */
      let ref = props['ref']
      if (ref) {
        let subList = exports.getRunList(jobs, ref)
        exports.runlist(jobs, subList, dryrun, (completed) => {
          if (completed)
            loop.next()
          else
            loop.brk()
        })
        return
      }

      /* prepare process callbacks */
      const onSpawn = function (cmd, pid) {
          slaveLog(jobname, `[ spawn ] ${jobname}, pid=${pid}.`)
      }

      let failcnt = 0
      const onExit = function (cmd, exitcode) {
        slaveLog(jobname, `[ exitcode = ${exitcode} ] ${cmd}\n`)
        if (exitcode == 0) {
          failcnt = 0
          setTimeout(loop.next, 500)

        } else {
          failcnt ++
          slaveLog(jobname, `[ Fails ] ${failcnt} times.`)

          if (failcnt >= 3) {
            loop.brk()
          } else {
            loop.again()
          }
        }
      }

      if (dryrun) {
        const targetProps = jobs.depGraph.getNodeData(jobname)
        const cmd = targetProps['exe'] || ''

        slaveLog(jobname, `[ dry run ] ${jobname}`)
        onSpawn(cmd, -1)
        onExit(cmd, 0)
        return
      }

      exports.runjob(jobs, jobname, onSpawn, onExit, function () {
        slaveLog(jobname, `[ test failed ] ${jobname} aborted`)
        loop.brk()
      })
    },

    /* done loop */
    function (_, idx, loop, completed) {
      let list_job_names = runList.join(', ')
      masterLog(`[ finished(${completed}) ] ${list_job_names}.`)

      onComplete && onComplete(completed)
    }
  )
}

if (require.main === module) {
  ;(async function () {
    const jobs = await jobs_ldr.load('./test-jobs')
    const runList = await exports.getRunList(jobs, 'hello-world:say-helloworld')
    console.log(runList)
    //exports.runlist(jobs, runList, 1)
    exports.runlist(jobs, runList)
  })()
}
