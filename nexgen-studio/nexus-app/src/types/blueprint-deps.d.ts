declare module 'bullmq' {
  export class Queue {
    constructor(name: string, options?: any)
    add(name: string, data?: any, options?: any): Promise<any>
    close(): Promise<void>
  }

  export class Worker {
    constructor(name: string, processor: (job: any) => Promise<any>, options?: any)
    on(event: string, listener: (...args: any[]) => void): this
    close(): Promise<void>
  }
}

declare module 'ioredis' {
  export default class IORedis {
    constructor(url: string)
    publish(channel: string, message: string): Promise<number>
    subscribe(channel: string): Promise<any>
    unsubscribe(channel: string): Promise<any>
    on(event: string, listener: (...args: any[]) => void): this
    quit(): Promise<void>
  }
}

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(options?: any)
    send(command: any): Promise<any>
  }

  export class PutObjectCommand {
    constructor(input?: any)
  }

  export class GetObjectCommand {
    constructor(input?: any)
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(client: any, command: any, options?: any): Promise<string>
}

declare module 'ws' {
  export default class WebSocket {
    constructor(url: string)
    on(event: string, listener: (...args: any[]) => void): this
    close(): void
  }
}
