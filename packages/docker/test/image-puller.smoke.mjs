import assert from 'node:assert/strict';
import test from 'node:test';
import {
  probeDockerDaemon,
} from '../dist/docker-client.factory.js';
import {
  inspectDockerImage,
  normalizeRegistryServer,
  pullDockerImage,
  redactDockerAuth,
  registryAuthFromEnv,
  registryFromImage,
  stripRegistryScheme,
} from '../dist/docker-image-puller.js';

function fakeDocker(overrides = {}) {
  const calls = {
    pull: [],
    followProgress: 0,
    getImage: [],
  };
  return {
    calls,
    ping: async () => undefined,
    version: async () => ({ ServerVersion: '25.0.3-test-build-extra-long-version' }),
    getImage: (image) => {
      calls.getImage.push(image);
      return {
        inspect: async () => ({ Id: `sha256:${image}` }),
      };
    },
    pull: (image, options, callback) => {
      calls.pull.push({ image, options });
      callback(null, { fakeStream: true });
    },
    modem: {
      followProgress: (_stream, callback) => {
        calls.followProgress += 1;
        callback(null);
      },
    },
    ...overrides,
  };
}

test('probeDockerDaemon returns safe ready status and trimmed version', async () => {
  const result = await probeDockerDaemon(fakeDocker(), 100);
  assert.equal(result.ok, true);
  assert.equal(result.version, '25.0.3-test-build-extra-long-version');
});

test('probeDockerDaemon redacts failure shape into a bounded message', async () => {
  const result = await probeDockerDaemon(
    fakeDocker({
      ping: async () => {
        throw new Error('daemon unavailable '.repeat(40));
      },
    }),
    100,
  );
  assert.equal(result.ok, false);
  assert.ok(result.message.length <= 240);
  assert.match(result.message, /daemon unavailable/);
});

test('inspectDockerImage reports local image presence without a daemon dependency', async () => {
  const result = await inspectDockerImage(fakeDocker(), 'registry.local/app:1', 100);
  assert.deepEqual(result, {
    present: true,
    imageId: 'sha256:registry.local/app:1',
  });
});

test('registry helpers only produce auth for matching configured registries', () => {
  assert.equal(registryFromImage('registry.local:5000/team/app:1'), 'registry.local:5000');
  assert.equal(registryFromImage('library/ubuntu:latest'), '');
  assert.equal(stripRegistryScheme('https://registry.local'), 'registry.local');
  assert.equal(normalizeRegistryServer('registry.local'), 'https://registry.local');

  assert.deepEqual(
    registryAuthFromEnv('registry.local/team/app:1', {
      DOCKER_REGISTRY_USERNAME: 'alice',
      DOCKER_REGISTRY_PASSWORD: 'secret',
      DOCKER_REGISTRY_SERVER: 'https://registry.local',
    }),
    {
      username: 'alice',
      password: 'secret',
      serveraddress: 'https://registry.local',
    },
  );

  assert.equal(
    registryAuthFromEnv('other.local/team/app:1', {
      DOCKER_REGISTRY_USERNAME: 'alice',
      DOCKER_REGISTRY_PASSWORD: 'secret',
      DOCKER_REGISTRY_SERVER: 'registry.local',
    }),
    undefined,
  );
});

test('pullDockerImage passes platform and matching authconfig to Dockerode', async () => {
  const docker = fakeDocker();
  const registryAuth = {
    username: 'alice',
    password: 'secret',
    serveraddress: 'https://registry.local',
  };
  const result = await pullDockerImage(docker, {
    image: 'registry.local/team/app:1',
    platform: 'linux/amd64',
    registryAuth,
    timeoutMs: 100,
  });

  assert.equal(result.ok, true);
  assert.equal(docker.calls.followProgress, 1);
  assert.deepEqual(docker.calls.pull, [
    {
      image: 'registry.local/team/app:1',
      options: {
        platform: 'linux/amd64',
        authconfig: registryAuth,
      },
    },
  ]);
});

test('pullDockerImage redacts auth details from Docker failures', async () => {
  const registryAuth = {
    username: 'alice',
    password: 'secret',
    serveraddress: 'https://registry.local',
  };
  const docker = fakeDocker({
    pull: (_image, _options, callback) => {
      callback(new Error('login failed for alice with password secret'), null);
    },
  });

  const result = await pullDockerImage(docker, {
    image: 'registry.local/team/app:1',
    registryAuth,
    timeoutMs: 100,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message.includes('alice'), false);
  assert.equal(result.message.includes('secret'), false);
  assert.match(result.message, /\*\*\*/);
});

test('redactDockerAuth leaves unauthenticated messages untouched', () => {
  assert.equal(redactDockerAuth('plain docker error', undefined), 'plain docker error');
});
