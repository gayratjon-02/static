/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    env: {
        REACT_APP_API_URL: process.env.REACT_APP_API_URL,
        REACT_APP_API_GRAPHQL_URL: process.env.REACT_APP_API_GRAPHQL_URL,
        REACT_APP_API_WS: process.env.REACT_APP_API_WS,
    },
    images: {
        domains: [],
    },
};

module.exports = nextConfig;
