// SCRUM-28: tests for the deleteDebate GraphQL mutation (CRUD: Delete).
// Rules: only the creator may delete, and only while the debate is open with no
// opponent. Runs against MONGO_URI (local Docker Mongo on 27018 by default).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27018/debateapp_test';

const { expect } = require('chai');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Debate = require('../models/Debate');

const PORT = 5111;
let server;

function token(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function gql(query, authToken) {
  const res = await fetch(`http://localhost:${PORT}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

describe('SCRUM-28: deleteDebate mutation', function () {
  this.timeout(10000);
  let creator, other, debater;

  before(async () => {
    await mongoose.connect(process.env.MONGO_URI);
    await mongoose.connection.dropDatabase();
    await app.setupGraphQL();
    await new Promise((r) => (server = app.listen(PORT, r)));
    creator = await User.create({ name: 'Creator', email: `c${Date.now()}@t.dev`, password: 'password123', role: 'moderator' });
    other = await User.create({ name: 'Other', email: `o${Date.now()}@t.dev`, password: 'password123', role: 'moderator' });
    debater = await User.create({ name: 'Debater', email: `d${Date.now()}@t.dev`, password: 'password123' });
  });

  after(async () => {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.connection.close();
  });

  it('lets the creator delete their own open debate', async () => {
    const d = await Debate.create({ motion: 'Delete me', creator: creator._id, proposition: creator._id, status: 'open' });
    const out = await gql(`mutation { deleteDebate(id:"${d._id}") }`, token(creator));
    expect(out.errors).to.be.undefined;
    expect(out.data.deleteDebate).to.equal(true);
    expect(await Debate.findById(d._id)).to.equal(null);
  });

  it('rejects deletion by a non-creator', async () => {
    const d = await Debate.create({ motion: 'Not yours', creator: creator._id, proposition: creator._id, status: 'open' });
    const out = await gql(`mutation { deleteDebate(id:"${d._id}") }`, token(other));
    expect(out.errors[0].message).to.match(/only the creator/i);
    expect(await Debate.findById(d._id)).to.not.equal(null); // still there
  });

  it('rejects deletion once an opponent has joined (in-progress)', async () => {
    const d = await Debate.create({
      motion: 'In progress', creator: creator._id, proposition: creator._id,
      opposition: debater._id, status: 'in-progress',
    });
    const out = await gql(`mutation { deleteDebate(id:"${d._id}") }`, token(creator));
    expect(out.errors[0].message).to.match(/open debate with no opponent/i);
    expect(await Debate.findById(d._id)).to.not.equal(null);
  });

  it('rejects an unauthenticated delete', async () => {
    const d = await Debate.create({ motion: 'Anon', creator: creator._id, proposition: creator._id, status: 'open' });
    const out = await gql(`mutation { deleteDebate(id:"${d._id}") }`);
    expect(out.errors[0].message).to.match(/not authenticated/i);
  });
});
