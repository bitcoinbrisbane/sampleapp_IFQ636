import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';

// GraphQL endpoint. In production the React build is served by Nginx on the same
// origin and /graphql is reverse-proxied to Node; in dev the backend is on :5001.
const uri =
  process.env.REACT_APP_GRAPHQL_URL ??
  (process.env.NODE_ENV === 'production'
    ? '/graphql'
    : 'http://localhost:5001/graphql');

const httpLink = createHttpLink({ uri });

// Attach the JWT (saved at login) to every GraphQL request, mirroring the REST
// Authorization: Bearer <token> scheme the backend already uses.
const authLink = new SetContextLink((prevContext) => {
  let token = null;
  try {
    const stored = JSON.parse(localStorage.getItem('user'));
    token = stored?.token ?? null;
  } catch {
    token = null;
  }
  return {
    headers: {
      ...prevContext.headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
