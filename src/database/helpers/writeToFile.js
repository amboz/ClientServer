const faker = require('faker');
const jsonfile = require('jsonfile');
 
var outfile = './database/helpers/users.json';

const generateUser = () => {
  //40% chance of a zero balance
  let randomNumber = Math.ceil(Math.random() * 100);
  let userBalance = randomNumber > 40 ? Number(faker.finance.amount(1, 2999.99, 2)) : 0;

  //10% chance of a frozen account
  let userStatus = randomNumber > 10 ? '' : 'frozen';

  let userFirstName = faker.name.firstName();
  let userLastName = faker.name.lastName();

  let fakeUser = {
    username: faker.internet.userName(userFirstName, userLastName),
    email: faker.internet.email(userFirstName, userLastName),
    firstName: userFirstName,
    lastName: userLastName,
    balance: userBalance,
    accountStatus: userStatus
  }

  return fakeUser;
}

const generateNUsers = (n) => {
  for (var i = 1; i <= n; i++) {
    let user = generateUser();
    user.userId = i;
    jsonfile.writeFileSync(outfile, user, {flag: 'a', spaces: 0, EOL: '\r\n'}, function (err) {
      if (err) {
          return console.log('ERROR WITH ', err);
      }

    console.log("The file was saved with user: ", user);
    });
  }
}

generateNUsers(10000000);