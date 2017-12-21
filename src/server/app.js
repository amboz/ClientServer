import {MongoClient, ObjectId} from 'mongodb';
import express from 'express';
import bodyParser from 'body-parser';
import {graphqlExpress, graphiqlExpress} from 'graphql-server-express';
import {makeExecutableSchema} from 'graphql-tools';
import cors from 'cors';
import aws from 'aws-sdk';
import Consumer from 'sqs-consumer';
// const {User} = require('../database/Users.js');
// const mongoose = require('mongoose');

const mongoUri = 'mongodb://localhost:27017/usersdb';
// mongoose.Promise = global.Promise;
const URL = 'http://localhost';
const PORT = 3000;

//CLIENT-SERVER
//(1) get payment/cashout
  //--> generate and send to queue1
  //--> respond to client

//(2) respond to client polling
  //--> grab transactionID/user IDs/user balances from queue --> add to cache(?)
    //--> update cached transIDs/statuses and user balances
  //--> tell queue1 to delete message
  //-->respond to client with transaction status (by ID) by reading from cache?

//(3) reconcile balances
  //--> grab users and balances from queue2
  //--> write to db with updated balances
  //--> tell queue2 to delete message

export const start = async () => {
  try {
    const db = await MongoClient.connect(mongoUri);

    const User = db.collection('users');
    const TransactionId = db.collection('transactionIds');

    /* ======================== GRAPHQL SETUP ======================== */
    const typeDefs = [`
      type Query {
        user(username: String): User
        transactionId: TransactionId
      }

      type User {
        _id: String
        username: String
        email: String
        firstName: String
        lastName: String
        balance: Float
        accountStatus: String
        userId: Int
      }

      type TransactionId {
        _id: String
        transactionId: Int
      }

      type Transaction {
        _id: String!
        payer: User
        payee: User
        amount: Float
        transactionType: String
        transactionId: TransactionId
        timestamp: Float
      }

      type Mutation {
        createUser(
          _id: String
          username: String
          email: String
          firstName: String
          lastName: String
          balance: Float
          accountStatus: String
          userId: Int
        ): User

        incrementTransactionId: TransactionId

        generateTransaction(
          payerUsername: String
          payeeUsername: String
          amount: Float
        ): Transaction
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `];

    const resolvers = {
      Query: {
        //find a user by username
        user: async (root, {username}) => {
          return await User.findOne({username: username})
        },
        //find a transaction by transactionId
        transactionId: async (root, {transactionId}) => {
          //TransactionId is a single, incrementing counter so only one record will be returned from MongoDB
          //TODO: Refactor to look up from a cache
          return (await TransactionId.findOne({transactionId: transactionId}));
        }
      },
      Mutation: {
        createUser: async (root, args, context, info) => {
          const res = await User.insert(args)
          return (
            //TODO: autoincrement userId, return not null when inserted
            await User.find().limit(1).sort({$natural:-1})
          )
        },
        incrementTransactionId: async () => {
          return (
            //find latest document, increment transactionId by 1, create new record if none returned
            await TransactionId.updateOne({}, {$inc: {transactionId: 1}}, {upsert: true})
          )
        },
        generateTransaction: async (root, {payerUsername, payeeUsername, amount}) => {
          let transactionType = payerUsername === payeeUsername ? 'cashout' : 'payment';
          let payer = await User.findOne({username: payeeUsername});
          let payee = transactionType === 'cashout' ? payer : await User.findOne({username: payerUsername});
          let transactionId = await TransactionId.updateOne({}, {$inc: {transactionId: 1}}, {upsert: true});

          let output = {
            payer: {
              userId: payer.userId,
              firstName: payer.firstName,
              lastName: payer.lastName,
              balance: payer.balance
            },
            payee: {
              userId: payee.userId,
              firstName: payee.firstName,
              lastName: payee.lastName,
              balance: payee.balance
            },
            amount: amount,
            transactionType: transactionType,
            transactionId: await TransactionId.findOne({}),
            timestamp: new Date()
          }

          // console.log('OUTPUT', output);

          //send output to Transaction Queue
          let params = {
            MessageBody: JSON.stringify(output),
            QueueUrl: queueUrl,
            DelaySeconds: 0
          };

          sqs.sendMessage(params, (err, data) => {
            if (err) {
              console.log('error sending message to queue with', err);
            } else {
              console.log('msg sent to queue');
            } 
          });

          //below makes all fields available, responds with 200 OK
          return output;
        }
      }
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })

    /* ======================== AWS SQS (REST) ======================== */

    const app = express();
    const queueUrl = 'https://sqs.us-west-1.amazonaws.com/604151587804/TransactionQueue';
    const ledgerQueueUrl = 'https://sqs.us-west-1.amazonaws.com/604151587804/LedgerQueue';
    const fromQueueUrl = 'https://sqs.us-west-1.amazonaws.com/604151587804/fromTransactionQueue';
    let receipt = '';
    let fromReceipt = ''


    //instantiate sqs object with credentials
    aws.config.loadFromPath(__dirname + '/../../config.json');
    const sqs = new aws.SQS();

    // ***Create Queue: uncomment and fill in QueueName for new queue***
    app.get('/create', (req, res) => {
      let params = {
        QueueName: 'LedgerQueue'
      };

      sqs.createQueue(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
          res.send(data);
        }
      });
    });

    //List avail queues
    app.get('/list', (req, res) => {
      sqs.listQueues((err, data) => {
        if (err) {
          res.send(err);
        } else {
          res.send(data);
        }
      });
    });

    //Send a message
    app.get('/send', (req, res) => {
      let params = {
        MessageBody: 'Hello world!',
        QueueUrl: queueUrl,
        DelaySeconds: 0
      };

      sqs.sendMessage(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
          res.send(data);
        } 
      });
    });

    //Receive a message
    app.get('/receive', (req, res) => {
      let params = {
        QueueUrl: queueUrl,
        VisibilityTimeout: 600 // 10 min wait time for anyone else to process.
      };
    
      sqs.receiveMessage(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
          console.log('/receive MSG DATA', data);
          consumer.handleMessage();
          res.send(data);
        } 
      });
    });

    //Delete a message
    app.get('/delete', (req, res) => {
      let params = {
        QueueUrl: queueUrl,
        ReceiptHandle: receipt
      }
    
      sqs.deleteMessage(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
          res.send(data);
        } 
      });
    });

    //Purge queue
    app.get('/purge', (req, res) => {
      let params = {
        QueueUrl: queueUrl
      }
    
      sqs.purgeQueue(params, (err, data) => {
        if (err) {
          res.send(err);
        } else {
          res.send(data);
        } 
      });
    });

    /* ======================== TRANSACTION SERVICES WORKER ======================== */

    const worker = Consumer.create({
      queueUrl: queueUrl,
      region: 'us-west-1',
      batchSize: 10,
      handleMessage: (message, done) => {
        let body = JSON.parse(message.Body);
        //work is currently just logging the body of the message
        console.log('message body:', body);

        //TODO: write to cache (db for now?) with transactionId's and their statuses



        //done will remove the message from the queue
        return done();
      },
      sqs: sqs
    });

    worker.on('error', function (err) {
      console.log(err);
      //***TODO*** Implement redrive policy to move these messages to a dead letter queue and uncomment below
      // return done(err);
    });

    worker.on('empty', function () {
      console.log('Consumer is empty...');
    });

    //start polling
    worker.start();

    /* ======================== LEDGER WORKER ======================== */

    const ledgerWorker = Consumer.create({
      queueUrl: ledgerQueueUrl,
      region: 'us-west-1',
      batchSize: 10,
      handleMessage: (message, done) => {
        let body = JSON.parse(message.Body);

        body.forEach(async (obj) => {
          await User.updateOne({userId: obj.userId}, {$set: {balance: obj.balance}});
        })

        //done will remove the message from the queue
        return done();
      },
      sqs: sqs
    });

    ledgerWorker.on('error', function (err) {
      console.log(err);
      //***TODO*** Implement redrive policy to move these messages to a dead letter queue and uncomment below
      // return done(err);
    });

    ledgerWorker.on('empty', function () {
      console.log('Ledger Consumer is empty...');
    });

    //start polling
    ledgerWorker.start();

    //Testing Ledger Queue; uncomment to test and update userId's
    // app.get('/sendToLedger', (req, res) => {
    //   let body = [{"userId": 1, "balance": 100}, {"userId": 2, "balance": 100}, {"userId": 3, "balance": 100}, {"userId": 4, "balance": 100}, {"userId": 5, "balance": 100}];
    //   let params = {
    //     MessageBody: JSON.stringify(body),
    //     QueueUrl: ledgerQueueUrl,
    //     DelaySeconds: 0
    //   };

    //   sqs.sendMessage(params, (err, data) => {
    //     if (err) {
    //       res.send(err);
    //     } else {
    //       res.send(data);
    //     } 
    //   });
    // });

  /* ======================== CONNECTION/GRAPHQL ROUTES ======================== */

    app.use(cors());

    app.use('/graphql', bodyParser.json(), graphqlExpress({schema}))

    app.use('/graphiql', graphiqlExpress({
      endpointURL: '/graphql'
    }))

    app.listen(PORT, () => {
      console.log(`Listening on ${PORT}`)
    })

  } catch(err) {
    console.log(`error: ${err}`);
  }
}


// start();

// query {
//   user(userId: 100) {
//     username
//     email
//     firstName
//     lastName
//     balance
//     accountStatus
//     userId
//   }
// }

// mutation {
//   generateTransaction(payerUsername: "Ferne_Lueilwitz", payeeUsername: "Erna96", amount: 100) {
//     payer {
//       userId
//       firstName
//       lastName
//       balance
//     }
//     payee {
//       userId
//       firstName
//       lastName
//       balance
//     }
//     amount
//     transactionType
//     transactionId {
//       transactionId
//     }
//     timestamp
//   }
// }