import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentRunner } from '../worker/runner';
import { AGENT_SERVER_PORT } from '../server/constants';

describe('Worker Health Check', () => {
  let agentRunner: AgentRunner;
  const testPort = AGENT_SERVER_PORT + 1000;

  beforeAll(async () => {
    process.env.HEALTH_PORT = testPort.toString();
    process.env.LOG_LEVEL = 'error';
    
    agentRunner = new AgentRunner({ 
      sleepTime: 0.1,
      maxLoops: 1
    });
    
    await agentRunner.run();
  });

  afterAll(async () => {
    if (agentRunner) {
      await agentRunner.stop();
    }
  });

  it('should return 200 status from health check endpoint', async () => {
    const response = await fetch(`http://localhost:${testPort}/health`);
    
    expect(response.status).toBe(200);
    
    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
    expect(healthData).toHaveProperty('timestamp');
  });
});
