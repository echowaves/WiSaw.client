import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from,
} from "@apollo/client"

// const fetch = require('node-fetch')

// test
// const API_URI = 'https://5ddyoru5czdxnmdo2ywhqq775y.appsync-api.us-east-1.amazonaws.com/graphql'
// const API_KEY = 'da2-7ixzggf6n5gfpgltcjbx7mph3q'

// prod
const API_URI = 'https://nkoozahma5hgvexphkrli34klm.appsync-api.us-east-1.amazonaws.com/graphql'
const API_KEY = 'da2-grzaiwnu4vgorfxe2myanmn2tu'

const httpLink = new HttpLink({
  uri: API_URI,
  fetch,
  headers: {
    'X-Api-Key': API_KEY,
  },
})

export const gqlClient = new ApolloClient({// eslint-disable-line
  uri: API_URI,
  link: from([httpLink]),
  cache: new InMemoryCache(),
})
