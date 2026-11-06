const query = require("./queries");
const utils = require("./utils");

// check and delete expired links every 30 seconds
setInterval(async function () {
  try {
    const result = await query.link.batchRemove({ expire_in: ["<", utils.dateToUTC(new Date())] });
    if (result && result.deletedCount > 0) {
      console.log(`Cron: Deleted ${result.deletedCount} expired links`);
    }
  } catch (error) {
    console.error('Cron job error (batchRemove expired links):', error.message);
    // Don't crash the process, just log and continue
  }
}, 30_000);

// Handle uncaught errors in intervals
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
