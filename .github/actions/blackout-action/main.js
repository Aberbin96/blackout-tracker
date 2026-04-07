const { spawn } = require('child_process');
const path = require('path');

// Basic manual parsing of inputs if @actions/core is not yet available in the environment
// We try to use process.env['INPUT_SCRIPT'] which is how GitHub Actions passes inputs.
const scriptName = process.env.INPUT_SCRIPT;
const scriptArgs = process.env.INPUT_ARGS || '';
const useJitter = process.env.INPUT_JITTER === 'true';

if (!scriptName) {
  console.error('Error: [INPUT_SCRIPT] is not defined.');
  process.exit(1);
}

async function run() {
  if (useJitter) {
    const sleepTime = Math.floor(Math.random() * 120);
    console.log(`Staggering start by ${sleepTime} seconds...`);
    await new Promise(resolve => setTimeout(resolve, sleepTime * 1000));
  }

  const targetScript = path.join(__dirname, '../../../scripts', `${scriptName}.ts`);

  console.log(`--- Running ${scriptName} Action on Node 24 ---`);
  console.log(`Script: ${targetScript}`);
  console.log(`Args: ${scriptArgs}`);

  // Using 'npx tsx' to handle TypeScript files and environment variables correctly.
  const child = spawn('npx', ['tsx', targetScript, ...scriptArgs.split(' ').filter(Boolean)], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '../../../')
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`Script failed with exit code ${code}`);
      process.exit(code);
    }
    process.exit(0);
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
