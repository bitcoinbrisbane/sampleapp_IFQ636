const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');

const connectDB = require('./config/db');
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const buildContext = require('./graphql/context');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// REST: authentication (provided by the starter).
app.use('/api/auth', require('./routes/authRoutes'));

// GraphQL: the debate domain. Apollo Server 5 must be started before its
// Express middleware is mounted, so mounting is async. Call setupGraphQL()
// before listening (or before issuing GraphQL requests in tests).
let apollo;
async function setupGraphQL() {
  if (apollo) return apollo;
  apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use('/graphql', expressMiddleware(apollo, { context: buildContext }));
  return apollo;
}

async function start() {
  await connectDB();
  await setupGraphQL();
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () =>
    console.log(`Server running on port ${PORT} (REST /api/auth, GraphQL /graphql)`)
  );
}

// Start only when run directly; export app + setupGraphQL for tests.
if (require.main === module) {
  start();
}

module.exports = app;
module.exports.setupGraphQL = setupGraphQL;
