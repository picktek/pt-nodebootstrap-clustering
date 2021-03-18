const cluster = require('cluster');
const each    = require('lodash.foreach');
exports       = module.exports;

exports.setup = function () {
  console.log('Starting app in clustered mode');

  const numCPUs  = require('os').cpus().length;
  const timeouts = [];

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('fork', function forkingWorker(worker) {
    console.debug('Forking worker #' + worker.id);
    timeouts[worker.id] = setTimeout(function workerTimingOut() {
      console.error(['Worker taking too long to start']);
    }, 2000);
  });

  cluster.on('listening', function onClusterListening(worker, address) {
    console.log('Worker #' + worker.id + ' listening on port: ' + address.port);
    clearTimeout(timeouts[worker.id]);
  });

  cluster.on('online', function onClusterOnline(worker) {
    console.debug('Worker #' + worker.id + ' is online');
  });

  cluster.on('exit', function onClusterExit(worker, code, signal) {
    console.error(['The worker #' + worker.id + ' has exited with exitCode ' + worker.process.exitCode]);
    clearTimeout(timeouts[worker.id]);
    // Don't try to restart the workers when disconnect or destroy has been called
    if (worker.suicide !== true) {
      console.log('Worker #' + worker.id + ' did not commit suicide, restarting');
      cluster.fork();
    }
  });

  cluster.on('disconnect', function onClusterDisconnect(worker) {
    console.log('The worker #' + worker.id + ' has disconnected');
  });

  // Trick suggested by Ian Young (https://github.com/isaacs/node-supervisor/issues/40#issuecomment-4330946)
  // to make cluster and supervisor play nicely together:
  if (parseInt(process.env.NODE_HOT_RELOAD) === 1) {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    each(signals, function forEachQuitSignal(signal) {
      process.on(signal, function onQuitSignals() {
        each(cluster.workers, function destroyWorker(worker) {
          worker.destroy();
        });
      });
    });
  }
};
