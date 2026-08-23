#!/usr/bin/env node
/**
 * Generate a VAPID key pair for web push, and print where each half goes.
 *
 * VAPID is how a push service knows the notification came from this
 * application: the private key signs each send, and the public key is what the
 * browser was subscribed with. They are a pair — regenerating them invalidates
 * every subscription already in `push_subscriptions`, because a subscription is
 * bound to the public key it was created with.
 *
 * Nothing is written to disk on purpose. A generated key that lands in a file
 * is a key that gets committed, and this one signs on behalf of the whole
 * organisation. It goes into the environment and nowhere else.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

const line = '─'.repeat(72);

console.log(`\n${line}`);
console.log('VAPID KEYS — copy these into your environment. Not into a file.');
console.log(line);
console.log('\nNEXT_PUBLIC_VAPID_PUBLIC_KEY');
console.log(publicKey);
console.log('\nVAPID_PRIVATE_KEY');
console.log(privateKey);
console.log(`\n${line}`);
console.log(`
Vercel  ▸  Project ▸ Settings ▸ Environment Variables

  NEXT_PUBLIC_VAPID_PUBLIC_KEY   the public key above
                                 Production, Preview, Development
                                 Public by design: the browser needs it to
                                 subscribe, and NEXT_PUBLIC_ inlines it into
                                 the client bundle.

  VAPID_PRIVATE_KEY              the private key above
                                 Production, Preview, Development
                                 Secret. No NEXT_PUBLIC_ prefix, ever — the
                                 prefix alone would publish it to every
                                 browser that loads the app.

  VAPID_SUBJECT                  mailto:you@example.com  (optional)
                                 Contact the push service can reach if this
                                 application misbehaves. Defaults to the
                                 organisation's contact address.

Locally, put the same three in app/.env.local, which is gitignored.

Redeploy after adding them: environment variables are read at build time for
the NEXT_PUBLIC_ one, so an existing deployment will not pick it up.

Regenerating these later invalidates every existing subscription — every
device has to be toggled back on. Generate once, keep them.
`);
