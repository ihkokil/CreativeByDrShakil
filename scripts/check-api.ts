import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  // We don't have the student token, but wait, the API requires a token!
  // If we don't have a token, we can't test it via HTTP.
  console.log("Need token to test HTTP.");
}
run();
