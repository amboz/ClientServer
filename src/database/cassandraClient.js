import cassandra from 'cassandra-driver';

const cassandraHost = `${process.env.CASSANDRA_URI || 'localhost'}:${process.env.CASSANDRA_PORT || 9042}`;

const cassandraClient = new cassandra.Client({
  contactPoints: [cassandraHost], keyspace: 'users'
});

module.exports = cassandraClient;