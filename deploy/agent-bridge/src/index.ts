import { config, validateConfig } from './config.js';
import { ControlApiClient } from './control-api-client.js';
import { SkillsParser } from './skills-parser.js';
import { HeartbeatManager } from './heartbeat.js';
import { CommandPoller } from './command-poller.js';

async function main() {
  console.log('====================================');
  console.log('ClawDeploy Agent Bridge v1.0.0');
  console.log('====================================\n');

  try {
    // Validate configuration
    validateConfig();
    console.log();

    // Initialize Control API client
    const apiClient = new ControlApiClient(config.controlApiUrl);

    // Register agent with control plane
    const registration = await apiClient.registerAgent(
      config.agentName,
      config.agentDescription
    );
    console.log(`✓ Agent registered: ${registration.name} (${registration.agent_id})\n`);

    // Discover skills
    console.log('Discovering skills...');
    const skillsParser = new SkillsParser(config.openclawSkillsPath);
    const skills = await skillsParser.discoverSkills();
    console.log(`✓ Found ${skills.length} skill(s)\n`);

    // Start heartbeat
    const heartbeat = new HeartbeatManager(
      apiClient,
      config.heartbeatIntervalMs
    );
    heartbeat.start(skills.length);
    console.log('✓ Heartbeat started\n');

    // Start command poller
    const poller = new CommandPoller(
      apiClient,
      config.commandPollIntervalMs
    );
    poller.start();
    console.log('✓ Command poller started\n');

    console.log('====================================');
    console.log('Agent Bridge is running!');
    console.log(`Agent ID: ${registration.agent_id}`);
    console.log(`Control API: ${config.controlApiUrl}`);
    console.log('====================================\n');

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM, shutting down gracefully...');
      heartbeat.stop();
      poller.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, shutting down gracefully...');
      heartbeat.stop();
      poller.stop();
      process.exit(0);
    });

  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
