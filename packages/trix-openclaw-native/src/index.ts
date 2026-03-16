import { createTrixNativePlugin } from './plugin/plugin.js';

const plugin = {
  id: 'openclaw-native-channel',
  name: 'TRIX Native',
  description: 'TRIX native OpenClaw multimodal channel with pairing, QR onboarding, LAN relay, and persistent conversations',
  register(api: {
    registerChannel: (params: { plugin: ReturnType<typeof createTrixNativePlugin> }) => void;
    registerCli: (handler: (params: { program: unknown; config: Record<string, unknown> }) => void, options?: { commands?: string[] }) => void;
    config: Record<string, unknown>;
  }) {
    api.registerChannel({ plugin: createTrixNativePlugin() });

    // 注册 openclaw trix setup 命令
    api.registerCli((params: { program: unknown; config: Record<string, unknown> }) => {
      const program = params.program as {
        command: (name: string) => { description: (desc: string) => { addCommand: (cmd: unknown) => void } };
        createCommand: (name: string) => { description: (desc: string) => { action: (fn: () => Promise<void>) => void } };
      };

      program.command('trix')
        .description('TRIX Native channel commands')
        .addCommand(
          program.createCommand('setup')
            .description('Pair a TRIX Native device via QR code')
            .action(async () => {
              const cfg = api.config;
              const plugin = createTrixNativePlugin();

              // 调用 loginWithQrStart 生成配对码
              const { qrDataUrl, message } = await plugin.gateway.loginWithQrStart({
                cfg,
                accountId: 'default',
                timeoutMs: 300_000,
              });

              console.log('\n' + message + '\n');
              if (qrDataUrl) {
                console.log('QR Data URL available (use a QR viewer to display)');
              }

              console.log('Waiting for device to pair...');

              // 轮询等待配对完成
              const result = await plugin.gateway.loginWithQrWait({
                cfg,
                accountId: 'default',
                timeoutMs: 300_000,
              });

              if (result.connected) {
                console.log('\n✓ ' + result.message);
              } else {
                console.error('\n✗ ' + result.message);
                process.exit(1);
              }
            })
        );
    }, { commands: ['trix'] });
  },
};

export default plugin;
