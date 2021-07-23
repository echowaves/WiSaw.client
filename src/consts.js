import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  from
} from '@apollo/client'

// const fetch = require('node-fetch')

const getRequiredEnv = (envName) => {
  const envValue = import.meta.env[envName]

  if (!envValue) {
    throw new Error(`Missing required environment variable: ${envName}. Create .env from .env.example and restart the dev server.`)
  }

  return envValue
}

const API_URI = getRequiredEnv('VITE_API_URI')
const API_KEY = getRequiredEnv('VITE_API_KEY')

const httpLink = new HttpLink({
  uri: API_URI,
  fetch,
  headers: {
    'X-Api-Key': API_KEY
  }
})

export const gqlClient = new ApolloClient({// eslint-disable-line
  uri: API_URI,
  link: from([httpLink]),
  cache: new InMemoryCache()
})
