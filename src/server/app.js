const {MongoClient, ObjectId} = require('mongodb');
const express = require('express');
const bodyParser = require('body-parser');
const {graphqlExpress, graphiqlExpress} = require('graphql-server-express');
const {makeExecutableSchema} = require('graphql-tools');
const cors = require('cors');
// const {User} = require('../database/Users.js');
// const mongoose = require('mongoose');

const mongoUri = 'mongodb://localhost:27017/usersdb';
// mongoose.Promise = global.Promise;
const URL = 'http://localhost';
const PORT = 3000;

//CLIENT-SERVER TASKS:
//(1) get payment/cashout
  //--> generate and send to queue
  //--> respond to client

//(2) respond to client polling
  //--> grab transactionIDs and statuses from queue --> add to cache
  //--> tell queue to delete message
  //read from cache, respond with status

//(3) reconcile balances
  //--> grab users and balances from queue
  //--> write to db with updated balances
  //--> tell queue to delete message

export const start = async () => {
  try {
    const db = await MongoClient.connect(mongoUri);

    const User = db.collection('users');
    const TransactionId = db.collection('transactionIds');


    const typeDefs = [`
      type Query {
        user(username: String): User
        transactionId: TransactionId
        payment(usernameOne: String, usernameTwo: String, amount: Float): Transaction
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
        //find a transaction by transactionId?
        transactionId: async (root) => {
          //TransactionId is a single, incrementing counter so only one record will be returned
          let output = await TransactionId.findOne({});
          console.log('trans', output);
          return output;
        },
        //find a payment?
        payment: async (root, {usernameOne, usernameTwo, amount}) => {
          //associate usernames with user info
          let userOne = await User.findOne({username: usernameOne});
          let userTwo = await User.findOne({username: usernameTwo});

          let output = {
            payer: {
              userId: userOne.userId,
              firstName: userOne.firstName,
              balance: userOne.balance
            },
            payee: {
              userId: userTwo.userId,
              firstName: userTwo.firstName,
              balance: userTwo.balance
            }
          }

          return output;
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
            timestamp: Date.now()
          }

          console.log('OUTPUT', output);

          //TODO: respond to client with 200 OK?
          return output;
          //TODO: add to queue for Transactions Service
        }
      }
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })

    const app = express();

    app.use(cors());

    app.use('/graphql', bodyParser.json(), graphqlExpress({schema}))

    app.use('/graphiql', graphiqlExpress({
      endpointURL: '/graphql'
    }))

    app.listen(PORT, () => {
      console.log(`Listenting on ${PORT}`)
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