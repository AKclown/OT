import { Injectable } from '@nestjs/common';

export interface Operation {
  type: 'insert' | 'delete';
  position: number;
  text?: string;
  length?: number;
  revision: number;
  clientId: string;
}

interface RevisionLogs {
  revision: number;
  operation: Operation;
  timestamp: Date;
  clientId: string;
}

interface Document {
  id: string;
  content: string;
  revision: number;
  pendingOperations: Operation[];
  revisionLog: RevisionLogs[];
}

@Injectable()
export class OtService {
  private documents: Map<string, Document> = new Map();

  createDocument(docId: string, initDoc: string = ''): string {
    this.documents.set(docId, {
      id: docId,
      content: initDoc,
      revision: 0,
      pendingOperations: [],
      revisionLog: [],
    });

    return docId;
  }

  getDocument(docId: string): Document | undefined {
    console.log(this.documents);
    return this.documents.get(docId);
  }

  // !!!应该根据revision来截取，需要转换的changes
  private transformAgainst(
    incomingOp: Operation,
    pendingOp: Operation,
  ): Operation[] {
    // $ 基础的OT算法逻辑(文本编辑器)
    // $ 这只是一个简易版本、实际会更加复杂点
    if (incomingOp.position < pendingOp.position) {
      // 在先前changes的前面插入
      if (incomingOp.type === 'insert' && pendingOp.type === 'insert') {
        return [incomingOp];
      } else if (incomingOp.type === 'insert' && pendingOp.type === 'delete') {
        return [incomingOp];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'insert') {
        return [incomingOp];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'delete') {
        if (incomingOp.position + incomingOp.length! <= pendingOp.position) {
          // $ 非重叠删除
          return [incomingOp];
        } else {
          // $ 重叠删除
          if (
            incomingOp.position + incomingOp.length! >=
            pendingOp.position + pendingOp.length!
          ) {
            // 全部重叠
            const startLen = pendingOp.position - incomingOp.position;
            const endLen =
              incomingOp.position +
              incomingOp.length! -
              (pendingOp.position + pendingOp.length!);

            return [
              {
                ...incomingOp,
                length: startLen + endLen,
              },
            ];
          } else {
            // 部分重叠
            return [
              {
                ...incomingOp,
                length: pendingOp.position - incomingOp.position,
              },
            ];
          }
        }
      }
    } else if (incomingOp.position > pendingOp.position) {
      // 在先前changes的后面插入
      if (incomingOp.type === 'insert' && pendingOp.type === 'insert') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'insert' && pendingOp.type === 'delete') {
        return [
          { ...incomingOp, position: incomingOp.position - pendingOp.length! },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'insert') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'delete') {
        if (pendingOp.position + pendingOp.length! <= incomingOp.position) {
          // $ 非重叠删除
          return [
            {
              ...incomingOp,
              position: incomingOp.position - pendingOp.length!,
            },
          ];
        } else {
          // $ 重叠删除
          if (
            pendingOp.position + pendingOp.length! >=
            incomingOp.position + incomingOp.length!
          ) {
            // 全部重叠 (空操作)
            return [
              {
                ...incomingOp,
                length: 0,
              },
            ];
          } else {
            // 部分重叠
            return [
              {
                ...incomingOp,
                position: pendingOp.position,
                length:
                  incomingOp.position +
                  incomingOp.length! -
                  (pendingOp.position + pendingOp.length!),
              },
            ];
          }
        }
      }
    } else {
      // 与先前changes的相同的位置
      if (incomingOp.type === 'insert' && pendingOp.type === 'insert') {
        // 版本靠后的往后挪
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'insert' && pendingOp.type === 'delete') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position - pendingOp.length!,
          },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'insert') {
        return [
          {
            ...incomingOp,
            position: incomingOp.position + pendingOp.text!.length,
          },
        ];
      } else if (incomingOp.type === 'delete' && pendingOp.type === 'delete') {
        if (pendingOp.length === 0) {
          // 表示没有删除字符
          return [incomingOp];
        } else {
          // 重叠删除
          if (
            pendingOp.position + pendingOp.length! >=
            incomingOp.position + incomingOp.length!
          ) {
            // 全部重叠 (空操作)
            return [
              {
                ...incomingOp,
                length: 0,
              },
            ];
          } else {
            // 部分重叠
            return [
              {
                ...incomingOp,
                length: incomingOp.length! - pendingOp.length!,
              },
            ];
          }
        }
      }
    }

    return [incomingOp];
  }

  private transformOperation(
    incomingOp: Operation,
    pendingOps: Operation[],
  ): Operation[] {
    let transformedOps = [incomingOp];

    for (const pendingOp of pendingOps) {
      transformedOps = transformedOps.flatMap((op) =>
        this.transformAgainst(op, pendingOp),
      );
    }

    return transformedOps;
  }

  private applyOperationToDocument(doc: Document, op: Operation): void {
    if (op.type === 'insert') {
      doc.content =
        doc.content.slice(0, op.position) +
        op.text +
        doc.content.slice(op.position);
    } else if (op.type === 'delete') {
      doc.content =
        doc.content.slice(0, op.position) +
        doc.content.slice(op.position + op.length!);
    }
  }

  private getMissedRevisions(
    doc: Document,
    clientRevision: number,
  ): Operation[] {
    return doc.revisionLog
      .filter((entry) => entry.revision > clientRevision)
      .map((entry) => entry.operation);
  }

  private transformOperationAgainstHistory(
    operation: Operation,
    history: Operation[],
  ): Operation {
    let transformedOp = operation;
    for (const historicalOp of history) {
      transformedOp = this.transformAgainst(transformedOp, historicalOp)[0];
    }
    return transformedOp;
  }

  // 记录历史版本
  private addToRevisionLog(doc: Document, operation: Operation): void {
    doc.revisionLog.push({
      // 当前的版本加1
      revision: doc.revision + 1,
      operation,
      timestamp: new Date(),
      clientId: operation.clientId,
    });
  }

  applyOperation(docId: string, operation: Operation): Operation[] {
    const doc = this.getDocument(docId);
    if (!doc) throw new Error('文档未找到');

    // 检查客户端版本和服务端版本
    if (operation.revision < doc.revision) {
      // $ 客户端版本小于服务端版本
      const missedOperate = this.getMissedRevisions(doc, operation.revision);
      operation = this.transformOperationAgainstHistory(
        operation,
        missedOperate,
      );
    }

    // $ 将传入操作与待处理操作进行转换
    const transformedOps = this.transformOperation(
      operation,
      doc.pendingOperations,
    );

    // 将客户端changes应用到文档内容里
    transformedOps.forEach((op) => {
      this.applyOperationToDocument(doc, op);
      this.addToRevisionLog(doc, op);
      doc.revision++;
    });

    return transformedOps;
  }

  getDocHistory(docId: string, fromRevision: number): RevisionLogs[] {
    const doc = this.documents.get(docId);
    if (!doc) return [];

    return doc.revisionLog.filter(entry => entry.revision > fromRevision);
  }

  // 通知客户端操作已经被服务器应用
  // !!! 这里存在问题，服务器没有记录changes logs
  acknowledgeOperations(docId: string, upToRevision: number): void {
    const doc = this.getDocument(docId);
    if (!doc) throw new Error('文档未找到');
    doc.pendingOperations = doc.pendingOperations.filter(
      (op) => op.revision > upToRevision,
    );
  }
}
