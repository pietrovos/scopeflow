import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { ActivityEventDto } from '@scopeflow/shared';

/**
 * In-process fan-out of committed activity events. The realtime gateway subscribes;
 * with several API instances this would sit behind the socket.io Redis adapter.
 */
@Injectable()
export class ActivityBus {
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  publish(event: ActivityEventDto) {
    this.emitter.emit('event', event);
  }

  subscribe(listener: (event: ActivityEventDto) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
