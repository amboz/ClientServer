// const mongoose = require('mongoose');
// const db = require('./db.js');
// mongoose.Promise = global.Promise;

// //create user table
// const userSchema = new mongoose.Schema({
//   //id added automatically
//   username: String,
//   email: String,
//   firstName: String,
//   lastName: String,
//   balance: Number,
//   accountStatus: String,
//   userId: Number
// }, 
//   {
//     timestamps: true
//   }
// );

// const User = mongoose.model('User', userSchema);

// module.exports = {
//   User: User
// }


// //TODO: move db into app.js, keep User for importing