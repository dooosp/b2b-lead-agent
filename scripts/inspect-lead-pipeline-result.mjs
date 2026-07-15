import fs from 'node:fs';
import pipelineRunState from '../pipeline-run-state.js';

function valueAfter(args, flag, fallback = null) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

const args = process.argv.slice(2);
const resultFile = valueAfter(args, '--result-file');
const summaryFile = valueAfter(args, '--summary-file');

if (!resultFile) {
  console.error('ERR_PIPELINE_RESULT_FILE_REQUIRED');
  process.exitCode = 2;
} else {
  try {
    const result = pipelineRunState.readPipelineRunResult(resultFile);
    const summary = [
      '## Lead pipeline result',
      '',
      `- State: \`${result.state}\``,
      `- Outcome: \`${result.outcome}\``,
      `- Profile: \`${result.profileId}\``,
      `- Publication: \`${result.publication.publicationId || 'none'}\``,
      `- Remote published: \`${result.publication.remotePublished}\``,
      `- Notification: \`${result.notification.state}\``,
      '',
    ].join('\n');
    if (summaryFile) fs.appendFileSync(summaryFile, summary, 'utf8');
    console.log(`PIPELINE_RESULT_STATE=${result.state}`);
    console.log(`PIPELINE_RESULT_OUTCOME=${result.outcome}`);
  } catch (error) {
    console.error(error && error.code || 'ERR_PIPELINE_RESULT_INVALID');
    process.exitCode = 1;
  }
}
