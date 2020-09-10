const jobs_ldr = require('./jobs-ldr.js')
const logger = require('./logger.js')

function masterLog(data) {
  logger.write('_master_', data)
  console.log(data)
}

function slaveLog(jobname, data) {
  logger.write(jobname, data)
  masterLog(data)
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

exports.getRunList = async function (jobs, target, user) {
  const deps = jobs.depGraph.dependenciesOf(target)
  deps.push(target)
  return deps
}

exports.runlist = function (jobs, runList, user, _dryrun, onComplete) {
  const dryrun = _dryrun || false

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
        exports.runlist(jobs, subList, user, dryrun, (completed) => {
          if (completed)
            loop.next()
          else
            loop.brk()
        })
        return
      }

      /* prepare process callbacks */
      const onSpawn = function (jobname, pid) {
          slaveLog(jobname, `[ spawn ] ${jobname}, pid=${pid}.`)
      }

      let failcnt = 0
      const onExit = function (jobname, exitcode) {
        slaveLog(jobname, `[ exitcode ] ${exitcode}`)
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
        onSpawn(jobname, -1)
        slaveLog(jobname, `[ dry run ] ${jobname}`)
        onExit(jobname, 0)
        return
      }

      exports.runjob(jobs, jobname, user, onSpawn, onExit)
    },

    /* done loop */
    function (_, idx, loop, completed) {
      let list_job_names = runList.join(', ')
      masterLog(`[ finished(${completed}) ] ${list_job_names}.`)

      onComplete && onComplete(completed)
    }
  )
}

;(async function () {
  const jobs = await jobs_ldr.load('./test-jobs')
  const runList = await exports.getRunList(jobs, 'hello-world:say-helloworld')
  console.log(runList)
  exports.runlist(jobs, runList, 'dm', 1)
})()
