const MODELS = {
  1: {
    name: 'Gemma 4',
    description: 'A versatile model for general tasks.',
    capabilities: ['text generation', 'code generation', 'reasoning'],
    id: 'google/gemma-4-26b-a4b-it',
  },
  2: {
    name: 'Recursive:Flint ',
    description:
      'Recursive Flint is a large language model designed for code generation, understanding, and completion. It supports multiple programming languages and is optimized for software development tasks.',
    capabilities: [
      'code generation',
      'code understanding',
      'code completion',
      'multi-language support',
      'software development tasks',
    ],
    id: 'recursive/flint-v1.0:free',
  },
  3: {
    name: 'Openrouter Free',
    description:
      'The simplest way to get free inference. openrouter/free is a router that selects free models at random from the models available on OpenRoute',
    capabilities: ['access to a variety of free models'],
    id: 'openrouter/free',
  },
  4: {
    name: 'OpenAI: gpt-oss-120b',
    description: 'A model optimized for general tasks.',
    capabilities: ['text generation', 'reasoning, agentic and general-purpose tasks'],
    id: 'openai/gpt-oss-120b',
  },
  5: {
    name: 'Nvidia: Nemotron 3.5 Super VL',
    description:
      'open multimodal mixture-of-experts model from NVIDIA, with 12B active parameters out of 120B total. Ideal for long-running agents that combine visual understanding with reasoning and tool use.',
    capabilities: ['multimodal understanding', 'reasoning', 'tool use'],
    id: 'nvidia/nemotron-3.5-super-vl:free',
  },
};

module.exports = { MODELS };
