// Reseed the database with known test data for demoing/manual testing.
//
// Run inside the Docker stack:
//   docker compose exec backend yarn seed
// Or locally against the dev Mongo:
//   MONGO_URI=mongodb://localhost:27018/debateapp yarn --cwd backend seed
//
// Wipes the users + debates collections and inserts:
//   - 1 moderator, 2 debaters (all password: password123)
//   - an OPEN debate (needs an opponent)
//   - an IN-PROGRESS debate (opponent joined, a couple of arguments posted)
//   - a CLOSED debate (full 3 rounds) with a couple of votes + a winner
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Debate = require('./models/Debate');

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/debateapp';
const PASSWORD = 'password123';

const accounts = [
  { name: 'Morgan (Moderator)', email: 'moderator@demo.test', role: 'moderator' },
  { name: 'Dana (Debater)', email: 'debater1@demo.test', role: 'debater' },
  { name: 'Riley (Debater)', email: 'debater2@demo.test', role: 'debater' },
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected: ${MONGO_URI}`);

  // Clean slate.
  await Debate.deleteMany({});
  await User.deleteMany({});
  console.log('Cleared users + debates.');

  // Users (password is hashed by the User pre-save hook, so save() each).
  const byEmail = {};
  for (const a of accounts) {
    const u = new User({ ...a, password: PASSWORD });
    await u.save();
    byEmail[a.email] = u;
  }
  const moderator = byEmail['moderator@demo.test'];
  const dana = byEmail['debater1@demo.test'];
  const riley = byEmail['debater2@demo.test'];
  console.log('Created 3 users (password: password123).');

  const now = Date.now();
  const future = () => new Date(now + 24 * 60 * 60 * 1000);

  // 1) OPEN debate — no opponent yet.
  await Debate.create({
    motion: 'Remote work is better than the office',
    creator: moderator._id,
    proposition: moderator._id,
    status: 'open',
  });

  // 2) IN-PROGRESS debate — Dana joined, opening round posted, now round 2.
  await Debate.create({
    motion: 'Cats are better pets than dogs',
    creator: moderator._id,
    proposition: moderator._id,
    opposition: dana._id,
    status: 'in-progress',
    currentRound: 1,          // rebuttal round
    currentSide: 'proposition',
    turnDeadline: future(),
    arguments: [
      { round: 0, side: 'proposition', author: moderator._id, text: 'Cats are independent and low-maintenance.' },
      { round: 0, side: 'opposition', author: dana._id, text: 'Dogs are loyal companions and protect the home.' },
    ],
  });

  // 3) CLOSED debate — full 3 rounds, two votes, a winner.
  await Debate.create({
    motion: 'Pineapple belongs on pizza',
    creator: moderator._id,
    proposition: moderator._id,
    opposition: riley._id,
    status: 'closed',
    currentRound: 3,
    currentSide: 'proposition',
    turnDeadline: null,
    winner: 'proposition',
    arguments: [
      { round: 0, side: 'proposition', author: moderator._id, text: 'Sweet and savoury is a classic combination.' },
      { round: 0, side: 'opposition', author: riley._id, text: 'Fruit has no place on a traditional pizza.' },
      { round: 1, side: 'proposition', author: moderator._id, text: 'Hawaiian pizza is beloved worldwide.' },
      { round: 1, side: 'opposition', author: riley._id, text: 'Popularity does not equal correctness.' },
      { round: 2, side: 'proposition', author: moderator._id, text: 'Taste is subjective and many enjoy it.' },
      { round: 2, side: 'opposition', author: riley._id, text: 'Tradition should be respected.' },
    ],
    votes: [
      { voter: dana._id, side: 'proposition' },
      { voter: riley._id, side: 'proposition' },
    ],
  });

  console.log('Seeded: 1 open, 1 in-progress, 1 closed debate.');
  console.log('Accounts (password: password123):');
  accounts.forEach((a) => console.log(`  ${a.role.padEnd(9)} ${a.email}`));

  await mongoose.connection.close();
}

run().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
