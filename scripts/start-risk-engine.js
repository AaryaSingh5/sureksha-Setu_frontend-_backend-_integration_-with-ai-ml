import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const riskEngineDir = path.resolve(__dirname, '../risk_engine');
const venvDir = path.join(riskEngineDir, 'venv');
const requirementsTxtPath = path.join(riskEngineDir, 'requirements.txt');

// Helper to run commands synchronously and log output
function runCommand(command, args, options = {}) {
  console.log(`[RISK ENGINE SETUP] Running: ${command} ${args.join(' ')}`);
  try {
    // Quote command and arguments to handle spaces in paths
    const quotedArgs = args.map(arg => arg.includes(' ') || arg.includes('\\') ? `"${arg}"` : arg);
    execSync(`"${command}" ${quotedArgs.join(' ')}`, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`[RISK ENGINE SETUP] Failed running: ${command} ${args.join(' ')}`);
    return false;
  }
}

// Detect Python executable
function getPythonCommand() {
  const commands = ['python', 'python3', 'py'];
  for (const cmd of commands) {
    try {
      execSync(`"${cmd}" --version`, { stdio: 'ignore' });
      console.log(`[RISK ENGINE SETUP] Detected python command: ${cmd}`);
      return cmd;
    } catch (e) {
      // ignore and try next
    }
  }
  throw new Error('Python executable not found. Please ensure Python is installed and added to PATH.');
}

async function main() {
  try {
    const pythonCmd = getPythonCommand();

    // Create Virtual Environment if it does not exist
    if (!fs.existsSync(venvDir)) {
      console.log(`[RISK ENGINE SETUP] Virtual environment not found. Creating venv in ${venvDir}...`);
      const success = runCommand(pythonCmd, ['-m', 'venv', 'venv'], { cwd: riskEngineDir });
      if (!success) {
        throw new Error('Failed to create virtual environment.');
      }
    } else {
      console.log('[RISK ENGINE SETUP] Virtual environment already exists.');
    }

    // Locate virtual environment python path
    const isWindows = process.platform === 'win32';
    const venvPythonPath = isWindows 
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python');

    if (!fs.existsSync(venvPythonPath)) {
      throw new Error(`Virtual environment python executable not found at: ${venvPythonPath}`);
    }

    // Upgrade pip
    console.log('[RISK ENGINE SETUP] Upgrading pip inside venv...');
    let success = runCommand(venvPythonPath, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    if (!success) {
      console.warn('[RISK ENGINE WARNING] Failed to upgrade pip. Proceeding with dependency installation...');
    }

    // Install requirements
    console.log('[RISK ENGINE SETUP] Installing/checking dependencies from requirements.txt...');
    success = runCommand(venvPythonPath, ['-m', 'pip', 'install', '-r', 'requirements.txt'], { cwd: riskEngineDir });
    if (!success) {
      console.error('[RISK ENGINE ERROR] Dependency installation failed! The application may not start or run correctly.');
      // We will still attempt to run uvicorn in case most dependencies succeeded
    }

    // Start Uvicorn
    console.log('[RISK ENGINE] Starting risk engine on http://0.0.0.0:8001 ...');
    const uvicornProcess = spawn(
      venvPythonPath,
      ['-m', 'uvicorn', 'main:app', '--port', '8001', '--host', '0.0.0.0'],
      { cwd: riskEngineDir, stdio: 'inherit', shell: false }
    );

    // Handle process termination to clean up uvicorn
    const handleExit = (signal) => {
      if (uvicornProcess && !uvicornProcess.killed) {
        console.log(`[RISK ENGINE] Stopping service (received signal: ${signal})...`);
        uvicornProcess.kill(signal);
      }
    };

    process.on('SIGINT', () => {
      handleExit('SIGINT');
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      handleExit('SIGTERM');
      process.exit(0);
    });

    uvicornProcess.on('close', (code) => {
      console.log(`[RISK ENGINE] Process exited with code ${code}`);
      process.exit(code || 0);
    });

    uvicornProcess.on('error', (err) => {
      console.error('[RISK ENGINE] Error spawning uvicorn:', err);
      process.exit(1);
    });

  } catch (error) {
    console.error('[RISK ENGINE SETUP ERROR]', error.message);
    process.exit(1);
  }
}

main();
