const faker = require('faker');
const fs = require('fs');
const Uuid = require('cassandra-driver').types.Uuid;
const outfile = './userDataToSeed.csv';

//uncomment for json file
//const jsonfile = require('jsonfile');
//const outfile = './users3.json';

const generateUser = () => {
  //40% chance of a zero balance
  let randomNumber = Math.ceil(Math.random() * 100);
  let userBalance = randomNumber > 40 ? Number(faker.finance.amount(1, 2999.99, 2)) : 0;

  //10% chance of a frozen account (frozen accounts have the value of true)
  let userStatus = randomNumber > 10 ? false: true;

  let userFirstName = faker.name.firstName();
  let userLastName = faker.name.lastName();

  let fakeUser = {
    username: faker.internet.userName(userFirstName, userLastName),
    email: faker.internet.email(userFirstName, userLastName),
    firstName: userFirstName,
    lastName: userLastName,
    balance: userBalance,
    accountStatus: userStatus,
    uid: Uuid.random()
  }

  return fakeUser;
}

//Generates n users and writes to a jsonfile
// const generateNUsers = (n) => {
//   for (let i = 1; i <= n; i++) {
//     let user = generateUser();
//     user.userNo = i;
//     jsonfile.writeFileSync(outfile, user, {flag: 'a', spaces: 0, EOL: ',\r\n'}, function (err) {
//       if (err) {
//           return console.log(`ERROR WITH ${err}`);
//       }

//     // console.log(`The file was saved with user: ${user}`);
//     });
//   }
// }

//Generates n users and writes to a CSV file
const generateNUsers = (n) => {
  let stream = fs.createWriteStream(outfile, {'flags': 'a', 'mode': 0666});
  stream.once('open', (fd) => {
    for (let i = 1; i <= n; i++) {
      let user = generateUser();
      user.userNo = i;

      let vals = [];

      for (let key in user) {
        vals.push(user[key].toString());
      }

      stream.write(vals.join(', ') + '\n');

      if (i % 100000 === 0) {
        console.log(`Written ${i} users to file`);
      }
    }
    stream.end();
    console.log('stream done');
  })
}

// generateNUsers(1000000);