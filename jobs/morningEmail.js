#!/usr/bin/env node
// Morning summary email — triggered 6:45 AM via Windows Task Scheduler.
// Next: fetch /api/* endpoints, render HTML + plain text, send via nodemailer.

require('dotenv').config();

async function sendMorningSummary() {
  throw new Error('sendMorningSummary not implemented');
}

if (require.main === module) {
  sendMorningSummary()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('morning email failed:', err);
      process.exit(1);
    });
}

module.exports = { sendMorningSummary };
