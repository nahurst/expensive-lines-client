# Getting started 

This project uses Jekyll to build a static site. Follow Jekyll installation prereqs and:

```
bundle install
npm install
```

The most important parts of the client are in `assets/js/main.js`.

Run locally against mainnet:
```
ETHEREUM_CONTRACT=0x3ed4e2fa5b6d2aeaa6c34d107adeb4661a135b62 ETHEREUM_NETWORK=mainnet bundle exec jekyll serve --livereload --incremental
```

Run locally if you have a local contract:
```
ETHEREUM_CONTRACT=0x5FbDB2315678afecb367f032d93F642f64180aa3 ETHEREUM_NETWORK=local bundle exec jekyll serve --livereload --incremental
```