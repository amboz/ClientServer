//get user
query {
  user(username: "Roy.Koepp16") {
    username
    email
    firstName
    lastName
    balance
    accountStatus
    userId
  }
}

//get transaction by Id
query {
  transactionId(transactionId: 1) {
    transactionId
    status
  }
}

//generate transaction
mutation {
  generateTransaction(payerUsername: "Ferne_Lueilwitz", payeeUsername: "Erna96", amount: 100) {
    payer {
      userId
      firstName
      lastName
      balance
    }
    payee {
      userId
      firstName
      lastName
      balance
    }
    amount
    transactionType
    transactionId {
      status
    }
    timestamp
  }
}

//cache transaction ID
mutation {
  cacheTransactionId(key: "transactionId", value: "pending")
}

//get transaction by Id
query {
  getTransactionId(key: "1")
}