This project uses Jekyll to build a static site.

The most important parts are in assets/js/main.js

Push to main to deploy to production.

Run locally using:
```
ETHEREUM_CONTRACT=0x5FbDB2315678afecb367f032d93F642f64180aa3 ETHEREUM_NETWORK=local bundle exec jekyll serve --livereload --incremental
```

You may also run against mainnet and the authoritative address by
getting it from expensivelines.com.
