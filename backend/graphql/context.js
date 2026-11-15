const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Build the GraphQL context: authenticate the caller the same way the REST
// `protect` middleware does — a Bearer JWT in the Authorization header. Resolvers
// read ctx.user (or null for anonymous requests) and enforce auth themselves.
async function buildContext({ req }) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return { user: null };
  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    return { user };
  } catch {
    return { user: null };
  }
}

module.exports = buildContext;
