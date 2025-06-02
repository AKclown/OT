import { io, Socket } from 'socket.io-client';

export interface Operation {
  type: 'insert' | 'delete';
  position: number;
  text?: string;
  length?: number;
}

export class OTClient {
  private socket: Socket;
  private docId: string;
  private document: string = '';
  private revision: number = 0;
  private pendingOperations: Operation[] = [];
  private sentOperations: Map<number, Operation[]> = new Map();
  private onChangeCallback: (content: string) => void;
  private pushing: boolean = false

  constructor(docId: string, onChange: (content: string) => void) {
    this.docId = docId;
    this.onChangeCallback = onChange;
    this.socket = io('http://localhost:3001');

    this.setupSocketListeners();
    this.joinRoom();
  }

  private setupSocketListeners(): void {
    this.socket.on('syncOTUpdates', (data: { content: string; revision: number }) => {
      this.document = data.content;
      this.revision = data.revision;
      this.onChangeCallback(this.document);
    });

    this.socket.on('pullOTUpdates', (data: { operations: Operation[]; revision: number }) => {
      this.applyRemoteOperations(data.operations, data.revision);
    });

    this.socket.on('pushOTUpdates', (data: { operations: Operation[]; revision: number }) => {
      this.acknowledgeOperations(data.revision);
    });
  }

  private joinRoom(): void {
    this.socket.emit('joinRoom', this.docId);
  }

  public applyLocalOperation(operation: Operation): void {
    // 立即在本地应用操作
    this.applyOperation(operation);

    // 添加待更新队列
    this.pendingOperations.push(operation);

    // 发送至服务端
    this.sendPendingOperations()
  }

  private sendPendingOperations(): void {
    if (!this.pendingOperations.length || this.pushing) return;

    // $ 在收到上一次changes确定ack之前，不能发送这一次的changes
    this.pushing = true

    // !!!存在问题版本
    // 将待更新的changes移动到已发送
    const operationsToSend = [...this.pendingOperations];
    const sentRevision = this.revision + operationsToSend.length;

    this.sentOperations.set(sentRevision, operationsToSend);
    this.pendingOperations = [];

    // 发送到服务端
    this.socket.emit('pushOTUpdates', {
      docId: this.docId,
      operations: operationsToSend.map(op => ({
        type: op.type,
        position: op.position,
        text: op.text,
        length: op.length,
      })),
      clientRevision: this.revision,
    });
  }

  private transformIncomingOperations(remoteOps: Operation[]): Operation[] {
    const sentOps = Array.from(this.sentOperations.entries())
      .sort(([revA], [revB]) => revA - revB)
      .flatMap(([_, ops]) => ops);

    return remoteOps.flatMap(remoteOp => {
      let transformedOp = remoteOp;
      for (const sentOp of sentOps) {

        transformedOp = this.transformOperation(transformedOp, sentOp);
      }
      return transformedOp;
    });
  }

  // 来自其他人的推送
  private applyRemoteOperations(operations: Operation[], newRevision: number): void {
    
    // 首先将远程传入操作与已发送未确认的changes进行转换
    const transformedIncomingOps = this.transformIncomingOperations(operations);
    

    // $ 将远程传入操作与待处理操作进行转换 （改变本地待更新的changes）
    this.pendingOperations = this.transformPendingOperations(this.pendingOperations, transformedIncomingOps);

    // 应用远程的changes到本地文档中 （不能直接应用文档，可能存在this.sentOperations)
    transformedIncomingOps.forEach(op => this.applyOperation(op));

    // 更新本地版本
    this.revision = newRevision;

    // 改变编辑器的文档内容
    this.onChangeCallback(this.document);
  }

  // 
  private acknowledgeOperations(ackRevision: number): void {
    // 从待更新中移除已确认的操作 （获取到这个远程版本之前的 所有已发送的changes，移除掉它）
    const revisionsToRemove = Array.from(this.sentOperations.keys())
      .filter(rev => rev <= ackRevision);

    // 更新版本
    revisionsToRemove.forEach(rev => {
      this.sentOperations.delete(rev);
    });

    // 更新客户端版本匹配上服务端版本
    this.revision = ackRevision;
    this.pushing = false

    // 如果待更新队列缓存在changes，再次推送给服务端
    if (this.pendingOperations.length > 0) {
      this.sendPendingOperations();
    }
  }

  private applyOperation(operation: Operation): void {
    if (operation.type === 'insert') {
      this.document =
        this.document.slice(0, operation.position) +
        operation.text +
        this.document.slice(operation.position);
    } else if (operation.type === 'delete') {
      this.document =
        this.document.slice(0, operation.position) +
        this.document.slice(operation.position + operation.length!);
    }
  }

  private transformPendingOperations(
    pendingOps: Operation[],
    remoteOps: Operation[]
  ): Operation[] {
    console.log('进行操作转换');
    // 转换待更新队列中的changes
    return pendingOps.flatMap(pendingOp => {
      let transformedOp = { ...pendingOp };

      for (const remoteOp of remoteOps) {
        transformedOp = this.transformOperation(transformedOp, remoteOp);
      }

      return transformedOp;
    });
  }

  private transformOperation(pendingOp: Operation, remoteOp: Operation): Operation {
    // $ 基础的OT算法逻辑(文本编辑器)

    if (pendingOp.position < remoteOp.position) {
      // 在先前changes的前面插入
      if (pendingOp.type === 'insert' && remoteOp.type === 'insert') {
        return pendingOp
      } else if (pendingOp.type === 'insert' && remoteOp.type === 'delete') {
        return pendingOp
      } else if (pendingOp.type === 'delete' && remoteOp.type === 'insert') {
        return pendingOp
      } else if (pendingOp.type === 'delete' && remoteOp.type === 'delete') {
        if (pendingOp.position + pendingOp.length! <= remoteOp.position) {
          // $ 非重叠删除
          return pendingOp
        } else {
          // $ 重叠删除
          if (
            pendingOp.position + pendingOp.length! >=
            remoteOp.position + remoteOp.length!
          ) {
            // 全部重叠
            const startLen = remoteOp.position - pendingOp.position;
            const endLen =
              pendingOp.position +
              pendingOp.length! -
              (remoteOp.position + remoteOp.length!);


            return {
              ...pendingOp,
              length: startLen + endLen,
            };
          } else {
            // 部分重叠
            return {
              ...pendingOp,
              length: remoteOp.position - pendingOp.position,
            };
          }
        }
      }
    } else if (pendingOp.position > remoteOp.position) {
      // 在先前changes的后面插入
      if (pendingOp.type === 'insert' && remoteOp.type === 'insert') {
        return {
          ...pendingOp,
          position: pendingOp.position + remoteOp.text!.length,
        };
      } else if (pendingOp.type === 'insert' && remoteOp.type === 'delete') {
        return { ...pendingOp, position: pendingOp.position - remoteOp.length! };
      } else if (pendingOp.type === 'delete' && remoteOp.type === 'insert') {
        return {
          ...pendingOp,
          position: pendingOp.position + remoteOp.text!.length,
        };
      } else if (pendingOp.type === 'delete' && remoteOp.type === 'delete') {
        if (remoteOp.position + remoteOp.length! <= pendingOp.position) {
          // $ 非重叠删除
          return {
            ...pendingOp,
            position: pendingOp.position - remoteOp.length!,
          };
        } else {
          // $ 重叠删除
          if (
            remoteOp.position + remoteOp.length! >=
            pendingOp.position + pendingOp.length!
          ) {
            // 全部重叠 (空操作)
            return {
              ...pendingOp,
              length: 0,
            };
          } else {
            // 部分重叠
            return {
              ...pendingOp,
              position: remoteOp.position,
              length:
                pendingOp.position +
                pendingOp.length! -
                (remoteOp.position + remoteOp.length!),
            };
          }
        }
      }
    } else {
      // 与先前changes的相同的位置
      if (pendingOp.type === 'insert' && remoteOp.type === 'insert') {
        // 版本靠后的往后挪
        return {
          ...pendingOp,
          position: pendingOp.position + remoteOp.text!.length,
        };
      } else if (pendingOp.type === 'insert' && remoteOp.type === 'delete') {
        return {
          ...pendingOp,
          position: pendingOp.position - remoteOp.length!,
        }
          ;
      } else if (pendingOp.type === 'delete' && remoteOp.type === 'insert') {
        return {
          ...pendingOp,
          position: pendingOp.position + remoteOp.text!.length,
        };
      } else if (pendingOp.type === 'delete' && remoteOp.type === 'delete') {
        if (remoteOp.length === 0) {
          // 表示没有删除字符
          return pendingOp
        } else {
          // 重叠删除
          if (
            remoteOp.position + remoteOp.length! >=
            pendingOp.position + pendingOp.length!
          ) {
            // 全部重叠 (空操作)
            return {
              ...pendingOp,
              length: 0,
            };
          } else {
            // 部分重叠
            return {
              ...pendingOp,
              length: pendingOp.length! - remoteOp.length!,
            };
          }
        }
      }
    }

    return pendingOp;
  }

  public disconnect(): void {
    this.socket.disconnect();
  }
}