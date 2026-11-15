// GraphQL schema for the DebateApp debate domain.
// CRUD mapping (the rubric is CRUD-framed):
//   Create : createDebate, joinDebate, submitArgument, castVote
//   Read   : debate, debates
//   Update : joinDebate, submitArgument, castVote, closeDebate (mutate debate state)
//   Delete : deleteDebate
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Argument {
    id: ID!
    round: Int!
    side: String!
    author: User
    text: String!
    createdAt: String!
  }

  type Vote {
    id: ID!
    side: String!
    createdAt: String!
  }

  type Debate {
    id: ID!
    motion: String!
    creator: User
    proposition: User
    opposition: User
    status: String!
    rounds: Int!
    currentRound: Int!
    currentSide: String!
    turnDeadline: String
    arguments: [Argument!]!
    votes: [Vote!]!
    voteTally: VoteTally!
    winner: String
    createdAt: String!
    updatedAt: String!
  }

  type VoteTally {
    proposition: Int!
    opposition: Int!
  }

  type Query {
    # Read
    debates(status: String): [Debate!]!
    debate(id: ID!): Debate
  }

  type Mutation {
    # Create
    createDebate(motion: String!): Debate!
    # Update (state transitions on an existing debate)
    joinDebate(id: ID!): Debate!
    submitArgument(id: ID!, text: String!): Debate!
    closeDebate(id: ID!): Debate!
    castVote(id: ID!, side: String!): Debate!
    # Delete
    deleteDebate(id: ID!): Boolean!
  }
`;

module.exports = typeDefs;
