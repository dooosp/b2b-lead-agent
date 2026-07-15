import notificationRunner from '../notification-runner.js';
import profileRegistry from '../profile-registry.js';

function valueAfter(args, flag, fallback = null) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

const args = process.argv.slice(2);
const resultFile = valueAfter(args, '--result-file');
const profileId = valueAfter(args, '--profile');
const remote = valueAfter(args, '--remote', 'origin');
const retryNotification = args.includes('--retry-notification');

if (!resultFile || !profileId || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(profileId)) {
  console.error('ERR_NOTIFICATION_CLI_USAGE');
  process.exitCode = 2;
} else {
  try {
    const notified = await notificationRunner.notifyPublishedPipelineRun({
      resultFile,
      profile: profileRegistry.loadAgentProfile(profileId),
      cwd: process.cwd(),
      remote,
      retryNotification,
      config: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
        recipients: process.env.GMAIL_RECIPIENT,
      },
    });
    console.log(`NOTIFICATION_RESULT=${notified.result.outcome}`);
  } catch (error) {
    console.error(error && error.code || 'ERR_NOTIFICATION_FAILED');
    process.exitCode = 1;
  }
}
