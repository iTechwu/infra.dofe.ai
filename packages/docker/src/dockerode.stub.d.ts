/**
 * Stub declarations for the 'dockerode' module.
 * dockerode is a peerDependency and ships no bundled types;
 * this file provides just enough surface area for the docker package.
 */

declare module 'dockerode' {
  // ── Types exposed via Docker.Xxx namespace ──

  interface ContainerInfo {
    Id: string;
    Names: string[];
    Image: string;
    ImageID: string;
    Command: string;
    Created: number;
    Ports: PortInfo[];
    Labels: Record<string, string>;
    State: string;
    Status: string;
    HostConfig: Record<string, any>;
    NetworkSettings: Record<string, any>;
    Mounts: any[];
  }

  interface PortInfo {
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }

  interface ListContainersOptions {
    all?: boolean;
    limit?: number;
    size?: boolean;
    filters?: Record<string, string[]>;
  }

  interface DockerOptions {
    socketPath?: string | null;
    host?: string;
    port?: number;
    protocol?: 'http' | 'https';
    [key: string]: any;
  }

  interface HostConfig {
    PortBindings?: Record<string, Array<{ HostPort: string }>>;
    Binds?: string[];
    RestartPolicy?: Record<string, any>;
    Memory?: number;
    NanoCpus?: number;
    LogConfig?: Record<string, any>;
    NetworkMode?: string;
    [key: string]: any;
  }

  // ── Main class ──

  class Docker {
    constructor(options?: DockerOptions);
    listContainers(options?: ListContainersOptions): Promise<ContainerInfo[]>;
    getContainer(id: string): any;
    getImage(name: string): any;
    createContainer(options: Record<string, any>): Promise<any>;
    pull(
      tag: string,
      options?: Record<string, any>,
      callback?: (err: Error | null, stream: NodeJS.ReadableStream) => void,
    ): any;
    ping(): Promise<any>;
    modem: any;
  }

  // ── Namespace merge so `Docker.ContainerInfo` etc. work ──

  namespace Docker {
    export { ContainerInfo, PortInfo, DockerOptions, HostConfig };
  }

  export default Docker;
}
