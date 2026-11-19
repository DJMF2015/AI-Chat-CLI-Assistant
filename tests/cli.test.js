jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('chalk', () => new (jest.requireActual('chalk').Instance)({ level: 0 }));
jest.mock('./cli_setup', () => ({
  checkApiKey: jest.fn(),
  loadFile: jest.fn(),
  rl: { question: jest.fn(), close: jest.fn() },
}));
jest.mock('../services/llm', () => ({ askLLM: jest.fn() }));
jest.mock('../services/sessionStore', () => ({
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));
jest.mock('../services/memory', () => ({
  initialiseSession: jest.fn(),
  setFile: jest.fn(),
  clearMemory: jest.fn(),
}));
jest.mock('../models/model_select', () => ({
  showModels: jest.fn(),
  selectModel: jest.fn(),
}));
jest.mock('../utils/clean', () => ({ formatResponse: jest.fn() }));
jest.mock('../utils/errorHandler', () => ({ handleError: jest.fn() }));

const dotenv = require('dotenv');
const { checkApiKey, loadFile, rl } = require('../cli/cli_setup');
const { askLLM } = require('../services/llm');
const { loadSession, clearSession } = require('../services/sessionStore');
const memory = require('../services/memory');
const { showModels, selectModel } = require('../models/model_select');
const { formatResponse } = require('../utils/clean');
const { handleError } = require('../utils/errorHandler');

const menuPrompt = 'Choose option:';
const sessionPrompt = 'Load previous session? (y/n):';
const questionPrompt = 'Enter your question or command:';
const filePrompt = 'Enter file path:';
const modelPrompt = 'Choose model number:';

async function runCli(steps = []) {
  const answers = [...steps, [menuPrompt, '5']];
  let exited = false;

  await new Promise((resolve, reject) => {
    jest.spyOn(process, 'exit').mockImplementation(() => {
      exited = true;
      resolve();
    });
    rl.question.mockImplementation((prompt, answer) => {
      // process stops at exit. With exit mocked, leave the next read pending.
      if (exited) return;

      const [expectedPrompt, response] = answers.shift() ?? [];
      if (prompt.trim() !== expectedPrompt) {
        reject(
          new Error(`Expected prompt "${expectedPrompt}", received "${prompt.trim()}"`),
        );
        return;
      }
      answer(response);
    });

    jest.isolateModules(() => require('../cli/cli'));
  });

  expect(answers).toEqual([]);
  expect(process.exit).toHaveBeenCalledTimes(1);
  expect(process.exit).toHaveBeenCalledWith(0);
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  loadSession.mockReturnValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('interactive CLI', () => {
  test('loads configuration, checks the API key, and exits after closing readline', async () => {
    await runCli();

    expect(dotenv.config).toHaveBeenCalledTimes(1);
    expect(checkApiKey).toHaveBeenCalledTimes(1);
    expect(loadSession).toHaveBeenCalledTimes(1);
    expect(dotenv.config.mock.invocationCallOrder[0]).toBeLessThan(
      checkApiKey.mock.invocationCallOrder[0],
    );
    expect(checkApiKey.mock.invocationCallOrder[0]).toBeLessThan(
      loadSession.mock.invocationCallOrder[0],
    );
    expect(console.log.mock.calls).toEqual(
      expect.arrayContaining([
        ['1. Ask a normal question'],
        ['2. Analyse a file'],
        ['3. Change model'],
        ['4. Clear memory'],
        ['5. Exit'],
      ]),
    );
    expect(rl.close).toHaveBeenCalledTimes(1);
    expect(rl.close.mock.invocationCallOrder[0]).toBeLessThan(
      process.exit.mock.invocationCallOrder[0],
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Goodbye!'));
    expect(memory.initialiseSession).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });

  test('does not offer to restore a session without messages', async () => {
    loadSession.mockReturnValue({ summary: 'Saved summary' });

    await runCli();

    expect(memory.initialiseSession).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });

  test('restores a saved session when the user answers with uppercase Y', async () => {
    loadSession.mockReturnValue({
      messages: [{ role: 'user', content: 'Earlier question' }],
    });

    await runCli([[sessionPrompt, 'Y']]);

    expect(memory.initialiseSession).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  test('clears the saved session when the user declines to restore it', async () => {
    loadSession.mockReturnValue({
      messages: [{ role: 'user', content: 'Earlier question' }],
    });

    await runCli([[sessionPrompt, 'n']]);

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(memory.initialiseSession).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Starting new session...');
  });

  test('sends a question to the LLM and prints the formatted response', async () => {
    askLLM.mockResolvedValue('Raw response');
    formatResponse.mockReturnValue('Formatted response');

    await runCli([
      [menuPrompt, '1'],
      [questionPrompt, 'Explain dependency injection.'],
    ]);

    expect(askLLM).toHaveBeenCalledWith('Explain dependency injection.');
    expect(formatResponse).toHaveBeenCalledWith('Raw response');
    expect(console.log).toHaveBeenCalledWith('Formatted response\n');
  });

  test('returns to the menu on a mixed-case back command without calling the LLM', async () => {
    await runCli([
      [menuPrompt, '1'],
      [questionPrompt, 'BaCk'],
    ]);

    expect(askLLM).not.toHaveBeenCalled();
    expect(formatResponse).not.toHaveBeenCalled();
  });

  test('loads a file and stores its content and path in memory', async () => {
    loadFile.mockResolvedValue('Project notes');

    await runCli([
      [menuPrompt, '2'],
      [filePrompt, './project notes.txt'],
    ]);

    expect(loadFile).toHaveBeenCalledWith('./project notes.txt');
    expect(memory.setFile).toHaveBeenCalledWith('Project notes', './project notes.txt');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('File loaded.'));
  });

  test('reports a file with no readable content and leaves file memory alone', async () => {
    loadFile.mockResolvedValue('');

    await runCli([
      [menuPrompt, '2'],
      [filePrompt, './empty.txt'],
    ]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Could not read file'),
    );
    expect(memory.setFile).not.toHaveBeenCalled();
  });

  test('lists models before prompting and passes the selected model as a number', async () => {
    await runCli([
      [menuPrompt, '3'],
      [modelPrompt, '2'],
    ]);

    expect(showModels).toHaveBeenCalledTimes(1);
    expect(showModels.mock.invocationCallOrder[0]).toBeLessThan(
      rl.question.mock.invocationCallOrder[1],
    );
    expect(selectModel).toHaveBeenCalledWith(2);
  });

  test('clears both in-memory and saved conversation state', async () => {
    await runCli([[menuPrompt, '4']]);

    expect(memory.clearMemory).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Memory cleared'));
  });

  test('reports an invalid choice and prompts again', async () => {
    await runCli([[menuPrompt, '9']]);

    expect(console.log).toHaveBeenCalledWith('Invalid choice');
    expect(askLLM).not.toHaveBeenCalled();
    expect(loadFile).not.toHaveBeenCalled();
    expect(showModels).not.toHaveBeenCalled();
    expect(memory.clearMemory).not.toHaveBeenCalled();
  });

  test.each([
    [
      'Prompt Mode',
      '1',
      questionPrompt,
      'Hello',
      (error) => askLLM.mockRejectedValue(error),
    ],
    [
      'File Mode',
      '2',
      filePrompt,
      './missing.txt',
      (error) => loadFile.mockRejectedValue(error),
    ],
    [
      'Select model mode',
      '3',
      modelPrompt,
      '99',
      (error) => {
        selectModel.mockImplementation(() => {
          throw error;
        });
      },
    ],
  ])(
    'handles a %s failure and returns to the menu',
    async (context, choice, prompt, input, failOperation) => {
      const error = new Error('Operation failed');
      failOperation(error);

      await runCli([
        [menuPrompt, choice],
        [prompt, input],
        [menuPrompt, '4'],
      ]);

      expect(handleError).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(error, context);
      expect(memory.clearMemory).toHaveBeenCalledTimes(1);
    },
  );
});
