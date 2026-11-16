# Kowloon app

The iOS and Android app for [Kowloon](https://kowloon.network), a small, open-source social network made of independent communities. Members of any Kowloon server can sign in with it, and it can hold more than one account at once.

It's a React Native app built with [Expo](https://expo.dev) (SDK 57) and Expo Router, in plain JavaScript. It talks to Kowloon servers only through [`@kowloon/client`](https://github.com/kowloon-network/kowloon-client), the same library the web frontend uses.

**Documentation: <https://kowloon.network/docs/>**

## Developing

This repository expects two sibling checkouts beside it, because it installs them from `../client` and `../design`:

```
kowloon/
  client/     https://github.com/kowloon-network/kowloon-client
  design/     https://github.com/kowloon-network/kowloon-design
  mobile/     this repository
```

You also need Node.js and a Kowloon server with an account on it to sign in to.

```bash
npm install       # .npmrc sets legacy-peer-deps; keep it
npm start         # Expo dev server
npm run android   # open on an Android device or emulator
npm run ios       # open on an iOS simulator (needs a Mac with Xcode)
npm run web       # quick preview in a browser
```

The app uses native modules that Expo Go doesn't include (sharing into the app, for one), so some features only work in a development build -- the `development` profile in `eas.json`, which uses `expo-dev-client`.

The browser preview is for quick checks only. The real web app is the [frontend](https://github.com/kowloon-network/kowloon-frontend).

`CLAUDE.md` and `DESIGN_SYSTEM.md` describe how the app is put together and the design decisions behind it.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before you start, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, see [SECURITY.md](SECURITY.md) -- please don't open a public issue.

## Licence

Licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE).
