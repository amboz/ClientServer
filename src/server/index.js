// const apm = require('elastic-apm-node').start({
//   appName: 'client-server'
// });

import newrelic from 'newrelic';
// import apm from 'elastic-apm-node/start';

import 'babel-core/register';
import 'babel-polyfill';
import {start} from './app.js';

start();