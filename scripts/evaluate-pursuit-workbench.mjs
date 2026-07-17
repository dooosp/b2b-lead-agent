#!/usr/bin/env node
import { evaluatePursuitWorkbench } from '../eval/pursuit-workbench-evaluator.mjs';

function parseArguments(argv) {
  let json = false;
  let repeat = 2;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') json = true;
    else if (argument === '--repeat' && argv[index + 1] && /^[0-9]+$/.test(argv[index + 1])) repeat = Number(argv[++index]);
    else throw new Error('PURSUIT_WORKBENCH_CLI_ARGUMENT_INVALID');
  }
  return { json, repeat };
}

try {
  const options = parseArguments(process.argv.slice(2));
  const report = await evaluatePursuitWorkbench({ repeat: options.repeat });
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${report.documentStatus}: ${report.summary.passed}/${report.summary.scenarioCount} scenarios\n`);
  if (report.documentStatus !== 'PURSUIT_WORKBENCH_EVALUATION_PASS') process.exitCode = 1;
} catch {
  process.stderr.write('Pursuit Workbench evaluation failed safely.\n');
  process.exitCode = 1;
}
