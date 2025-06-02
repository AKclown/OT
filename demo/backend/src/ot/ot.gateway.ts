import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { OtService, Operation } from './ot.service';
import { Server, Socket } from 'socket.io';

interface OTPayload {
  docId: string;
  operations: Operation[];
  clientRevision: number;
}

@WebSocketGateway({ cors: true })
export class OtGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly otService: OtService) { }

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.registerClientEventListeners(client);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  registerClientEventListeners(client: Socket) {
    client.on('joinRoom', (docId: string) => this.JoinRoom(client, docId));
    client.on('pushOTUpdates', (payload: OTPayload) =>
      this.pushOtUpdates(client, payload),
    );

    client.on('syncHistory', (payload) => this.syncHistory(client, payload));
  }

  JoinRoom(client: Socket, docId: string) {
    client.join(docId);

    let doc = this.otService.getDocument(docId);
    console.log('doc: JoinRoom', doc);
    if (!doc) {
      // 不存在则创建新的文档
      this.otService.createDocument(docId);
      doc = this.otService.getDocument(docId)!;
    }

    client.emit('syncOTUpdates', {
      content: doc.content,
      revision: doc.revision,
    });
  }

  pushOtUpdates(client: Socket, payload: OTPayload) {
    console.log('payload: ', payload);
    const { docId, operations, clientRevision } = payload;
    const doc = this.otService.getDocument(docId);
    console.log('doc: ', doc);

    if (!doc) {
      console.error('文档未找到, 请先创建文档！');
      return
    }

    // 应用并且转换操作
    const transformedOperations = operations.flatMap((op) =>
      this.otService.applyOperation(docId, {
        ...op,
        clientId: client.id,
        revision: clientRevision,
      }),
    );

    // 广播通知其他客户端
    client.to(docId).emit('pullOTUpdates', {
      operations: transformedOperations,
      revision: doc.revision,
    });

    // 向原始客户端发送确认事件 （如果没有收到确认事件呢）
    client.emit('pushOTUpdates', {
      operations: transformedOperations,
      revision: doc.revision,
    });
  }

  syncHistory(
    client: Socket,
    payload: { docId: string; fromRevision: number },
  ) {
    const history = this.otService.getDocHistory(
      payload.docId,
      payload.fromRevision,
    );
    client.emit('syncHistory', {
      docId: payload.docId,
      history,
      upToRevision: this.otService.getDocument(payload.docId)?.revision || 0,
    });
  }

  handleAcknowledge(payload: { docId: string; revision: number }) {
    this.otService.acknowledgeOperations(payload.docId, payload.revision);
  }
}
